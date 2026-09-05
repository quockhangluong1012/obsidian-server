using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Services;

public record ReadingBucketDto(DateTime StartUtc, DateTime EndUtc, double Seconds);
public record ReadingSummaryDto(string Range, double TotalSeconds, List<ReadingBucketDto> Buckets);
public record NoteReadingStatDto(string NoteId, string Title, string? FolderId, string Path, double TotalSeconds, int SessionCount, DateTime LastReadAt, bool Active);

public class ReadingTrackingService(AppDbContext db)
{
    // A heartbeat/end call accounts for wall-clock time since the last one. Clamp any single
    // gap so a suspended laptop or a delayed request can't silently inflate a note's total.
    private static readonly TimeSpan MaxAccrualGap = TimeSpan.FromSeconds(45);
    // A session with no heartbeat for this long is considered abandoned (crashed tab, lost
    // network on the unload beacon, ...) and is reaped opportunistically on the next Start.
    // Kept well above the client heartbeat interval so a legitimately active session on
    // another device is never touched.
    private static readonly TimeSpan StaleAfter = TimeSpan.FromMinutes(2);

    public async Task<ReadingSession> StartAsync(string noteId)
    {
        if (!await db.Notes.AnyAsync(n => n.Id == noteId))
            throw new KeyNotFoundException("Note not found");

        var staleCutoff = DateTime.UtcNow - StaleAfter;
        var stale = await db.ReadingSessions
            .Where(s => s.EndedAt == null && s.LastHeartbeatAt < staleCutoff)
            .ToListAsync();
        foreach (var s in stale) s.EndedAt = s.LastHeartbeatAt;

        var session = new ReadingSession { NoteId = noteId };
        db.ReadingSessions.Add(session);
        await db.SaveChangesAsync();
        return session;
    }

    public async Task<ReadingSession> HeartbeatAsync(string sessionId)
    {
        var s = await db.ReadingSessions.FindAsync(sessionId) ?? throw new KeyNotFoundException("Session not found");
        if (s.EndedAt == null)
        {
            Accrue(s);
            await db.SaveChangesAsync();
        }
        return s;
    }

    public async Task<ReadingSession> EndAsync(string sessionId)
    {
        var s = await db.ReadingSessions.FindAsync(sessionId) ?? throw new KeyNotFoundException("Session not found");
        if (s.EndedAt == null)
        {
            Accrue(s);
            s.EndedAt = s.LastHeartbeatAt;
            await db.SaveChangesAsync();
        }
        return s;
    }

    private static void Accrue(ReadingSession s)
    {
        var now = DateTime.UtcNow;
        var gap = now - s.LastHeartbeatAt;
        if (gap > TimeSpan.Zero)
            s.DurationSeconds += (int)Math.Round((gap > MaxAccrualGap ? MaxAccrualGap : gap).TotalSeconds);
        s.LastHeartbeatAt = now;
    }

    public async Task<ReadingSummaryDto> GetSummaryAsync(string range, string? tzId)
    {
        var tz = ResolveTimeZone(tzId);
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);

        List<(DateTime StartLocal, DateTime EndLocal)> buckets = range switch
        {
            "today" => HourBuckets(nowLocal),
            "7d" => DayBuckets(nowLocal, 7),
            "30d" => DayBuckets(nowLocal, 30),
            "1y" => MonthBuckets(nowLocal, 12),
            "all" => await AllTimeMonthBucketsAsync(nowLocal, tz),
            _ => throw new ArgumentException($"Unknown range '{range}'"),
        };

        if (buckets.Count == 0)
            return new ReadingSummaryDto(range, 0, new List<ReadingBucketDto>());

        var windowStartUtc = ToUtc(buckets[0].StartLocal, tz);
        var windowEndUtc = ToUtc(buckets[^1].EndLocal, tz);

        // Sessions overlapping the window: started before the window ends, and either still
        // open, ended after the window starts, or last heartbeat after the window starts.
        var rows = await db.ReadingSessions.AsNoTracking()
            .Where(s => s.StartedAt < windowEndUtc && (s.EndedAt == null || s.EndedAt >= windowStartUtc))
            .Select(s => new { s.StartedAt, s.EndedAt, s.LastHeartbeatAt, s.DurationSeconds })
            .ToListAsync();

        var bucketUtc = buckets.Select(b => (Start: ToUtc(b.StartLocal, tz), End: ToUtc(b.EndLocal, tz))).ToList();
        var totals = new double[buckets.Count];

        foreach (var r in rows)
        {
            var startUtc = r.StartedAt;
            var endUtc = r.EndedAt ?? r.LastHeartbeatAt;
            if (endUtc <= startUtc) continue;
            var span = (endUtc - startUtc).TotalSeconds;
            if (span <= 0) continue;

            for (var i = 0; i < bucketUtc.Count; i++)
            {
                var (bStart, bEnd) = bucketUtc[i];
                var overlapStart = startUtc > bStart ? startUtc : bStart;
                var overlapEnd = endUtc < bEnd ? endUtc : bEnd;
                var overlap = (overlapEnd - overlapStart).TotalSeconds;
                if (overlap > 0)
                    totals[i] += r.DurationSeconds * (overlap / span);
            }
        }

        var dtoBuckets = new List<ReadingBucketDto>(buckets.Count);
        for (var i = 0; i < buckets.Count; i++)
            dtoBuckets.Add(new ReadingBucketDto(bucketUtc[i].Start, bucketUtc[i].End, Math.Round(totals[i], 1)));

        return new ReadingSummaryDto(range, Math.Round(totals.Sum(), 1), dtoBuckets);
    }

    public async Task<List<NoteReadingStatDto>> GetNoteStatsAsync()
    {
        var staleCutoff = DateTime.UtcNow - StaleAfter;
        var agg = await db.ReadingSessions.AsNoTracking()
            .GroupBy(s => s.NoteId)
            .Select(g => new
            {
                NoteId = g.Key,
                TotalSeconds = g.Sum(x => x.DurationSeconds),
                SessionCount = g.Count(),
                LastReadAt = g.Max(x => x.EndedAt ?? x.LastHeartbeatAt),
                // still open (no EndedAt) and heartbeating recently => genuinely being read right now
                Active = g.Any(x => x.EndedAt == null && x.LastHeartbeatAt >= staleCutoff),
            })
            .ToListAsync();
        if (agg.Count == 0) return new();

        var noteIds = agg.Select(a => a.NoteId).ToList();
        var notes = await db.Notes.AsNoTracking()
            .Where(n => noteIds.Contains(n.Id))
            .Select(n => new { n.Id, n.Title, n.FolderId })
            .ToDictionaryAsync(n => n.Id);

        var folders = await db.Folders.AsNoTracking()
            .Select(f => new { f.Id, f.Name, f.ParentId })
            .ToDictionaryAsync(f => f.Id);

        string BuildPath(string? folderId)
        {
            var parts = new List<string>();
            var cur = folderId;
            while (cur != null && folders.TryGetValue(cur, out var f))
            {
                parts.Insert(0, f.Name);
                cur = f.ParentId;
            }
            return parts.Count == 0 ? "Vault" : string.Join(" / ", parts);
        }

        var result = new List<NoteReadingStatDto>();
        foreach (var a in agg)
        {
            // note may have been deleted (cascade already removed its sessions on the next
            // write, but a stale read between delete and cascade flush should still skip it)
            if (!notes.TryGetValue(a.NoteId, out var n)) continue;
            // SQL Server round-trips datetime2 as Kind=Unspecified; mark it Utc explicitly so
            // System.Text.Json emits a 'Z'-suffixed instant the client parses correctly.
            var lastReadAtUtc = DateTime.SpecifyKind(a.LastReadAt, DateTimeKind.Utc);
            result.Add(new NoteReadingStatDto(n.Id, n.Title, n.FolderId, BuildPath(n.FolderId), a.TotalSeconds, a.SessionCount, lastReadAtUtc, a.Active));
        }
        return result.OrderByDescending(r => r.LastReadAt).ToList();
    }

    private static TimeZoneInfo ResolveTimeZone(string? tzId)
    {
        if (string.IsNullOrWhiteSpace(tzId)) return TimeZoneInfo.Utc;
        try { return TimeZoneInfo.FindSystemTimeZoneById(tzId); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.Utc; }
        catch (InvalidTimeZoneException) { return TimeZoneInfo.Utc; }
    }

    private static DateTime ToUtc(DateTime local, TimeZoneInfo tz) =>
        TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), tz);

    private static List<(DateTime StartLocal, DateTime EndLocal)> HourBuckets(DateTime nowLocal)
    {
        var dayStart = nowLocal.Date;
        var list = new List<(DateTime, DateTime)>(24);
        for (var h = 0; h < 24; h++)
            list.Add((dayStart.AddHours(h), dayStart.AddHours(h + 1)));
        return list;
    }

    private static List<(DateTime StartLocal, DateTime EndLocal)> DayBuckets(DateTime nowLocal, int days)
    {
        var today = nowLocal.Date;
        var list = new List<(DateTime, DateTime)>(days);
        for (var i = days - 1; i >= 0; i--)
        {
            var d = today.AddDays(-i);
            list.Add((d, d.AddDays(1)));
        }
        return list;
    }

    private static List<(DateTime StartLocal, DateTime EndLocal)> MonthBuckets(DateTime nowLocal, int months)
    {
        var thisMonth = new DateTime(nowLocal.Year, nowLocal.Month, 1);
        var list = new List<(DateTime, DateTime)>(months);
        for (var i = months - 1; i >= 0; i--)
        {
            var m = thisMonth.AddMonths(-i);
            list.Add((m, m.AddMonths(1)));
        }
        return list;
    }

    private async Task<List<(DateTime StartLocal, DateTime EndLocal)>> AllTimeMonthBucketsAsync(DateTime nowLocal, TimeZoneInfo tz)
    {
        const int hardCapMonths = 120; // 10 years — a sane ceiling for a personal note vault
        var thisMonth = new DateTime(nowLocal.Year, nowLocal.Month, 1);
        var firstUtc = await db.ReadingSessions.AsNoTracking().OrderBy(s => s.StartedAt).Select(s => (DateTime?)s.StartedAt).FirstOrDefaultAsync();
        if (firstUtc == null)
            return new List<(DateTime, DateTime)> { (thisMonth, thisMonth.AddMonths(1)) };

        var firstLocal = TimeZoneInfo.ConvertTimeFromUtc(firstUtc.Value, tz);
        var firstMonth = new DateTime(firstLocal.Year, firstLocal.Month, 1);
        var span = ((thisMonth.Year - firstMonth.Year) * 12) + thisMonth.Month - firstMonth.Month + 1;
        span = Math.Clamp(span, 1, hardCapMonths);
        var startMonth = thisMonth.AddMonths(-(span - 1));

        var list = new List<(DateTime, DateTime)>(span);
        for (var i = 0; i < span; i++)
        {
            var m = startMonth.AddMonths(i);
            list.Add((m, m.AddMonths(1)));
        }
        return list;
    }
}
