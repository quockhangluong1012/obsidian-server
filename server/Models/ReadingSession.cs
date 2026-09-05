namespace Server.Models;

/// <summary>
/// One continuous interval of a note being the active "open" note in the client.
/// Opening another note, hiding/backgrounding the tab, or closing the app ends the
/// current session; re-focusing or re-opening starts a new one. <see cref="DurationSeconds"/>
/// is accumulated server-side from periodic heartbeats, so it is authoritative even if the
/// client crashes before calling End (see ReadingTrackingService for the reconciliation rules).
/// </summary>
public class ReadingSession
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string NoteId { get; set; } = string.Empty;
    public Note? Note { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    /// <summary>Last time we accounted for elapsed time (start, heartbeat, or end).</summary>
    public DateTime LastHeartbeatAt { get; set; } = DateTime.UtcNow;
    /// <summary>Null while the client considers the session still open.</summary>
    public DateTime? EndedAt { get; set; }
    /// <summary>Accumulated active reading time, in whole seconds.</summary>
    public int DurationSeconds { get; set; }
}
