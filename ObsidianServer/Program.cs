using Microsoft.EntityFrameworkCore;
using ObsidianServer.Components;
using ObsidianServer.Data;
using ObsidianServer.Features.Attachments;
using ObsidianServer.Features.Workspace;

var builder = WebApplication.CreateBuilder(args);
var databasePath = Path.Combine(builder.Environment.ContentRootPath, "App_Data", "obsidian.db");
Directory.CreateDirectory(Path.GetDirectoryName(databasePath)!);

builder.Services.AddDbContextFactory<ObsidianDbContext>(options => options.UseSqlite($"Data Source={databasePath}"));
builder.Services.AddScoped<WorkspaceService>();
builder.Services.AddScoped<AttachmentService>();
builder.Services.AddRazorComponents().AddInteractiveServerComponents();

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var databaseFactory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<ObsidianDbContext>>();
    await using var database = await databaseFactory.CreateDbContextAsync();
    await database.Database.EnsureCreatedAsync();
    await database.Database.ExecuteSqlRawAsync("CREATE VIRTUAL TABLE IF NOT EXISTS Notes_FTS USING fts5(Title, Content, content='Notes', content_rowid='rowid');");
    await database.Database.ExecuteSqlRawAsync("CREATE TRIGGER IF NOT EXISTS Notes_FTS_Insert AFTER INSERT ON Notes BEGIN INSERT INTO Notes_FTS(rowid, Title, Content) VALUES (new.rowid, new.Title, new.Content); END;");
    await database.Database.ExecuteSqlRawAsync("CREATE TRIGGER IF NOT EXISTS Notes_FTS_Update AFTER UPDATE ON Notes BEGIN INSERT INTO Notes_FTS(Notes_FTS, rowid, Title, Content) VALUES ('delete', old.rowid, old.Title, old.Content); INSERT INTO Notes_FTS(rowid, Title, Content) VALUES (new.rowid, new.Title, new.Content); END;");
    await database.Database.ExecuteSqlRawAsync("CREATE TRIGGER IF NOT EXISTS Notes_FTS_Delete AFTER DELETE ON Notes BEGIN INSERT INTO Notes_FTS(Notes_FTS, rowid, Title, Content) VALUES ('delete', old.rowid, old.Title, old.Content); END;");
    await database.Database.ExecuteSqlRawAsync("INSERT INTO Notes_FTS(Notes_FTS) VALUES ('rebuild');");
    if (!await database.Folders.AnyAsync())
    {
        database.Folders.Add(new Folder { Name = "Inbox" });
        await database.SaveChangesAsync();
    }
}

if (!app.Environment.IsDevelopment()) app.UseExceptionHandler("/Error", createScopeForErrors: true);
app.UseStaticFiles();
app.UseAntiforgery();
app.MapAttachmentEndpoints();
app.MapGet("/notes/{id:guid}/export", async (Guid id, IDbContextFactory<ObsidianDbContext> factory, CancellationToken cancellationToken) =>
{
    await using var database = await factory.CreateDbContextAsync(cancellationToken);
    var note = await database.Notes.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
    return note is null
        ? Results.NotFound()
        : Results.File(System.Text.Encoding.UTF8.GetBytes(note.Content), "text/markdown; charset=utf-8", $"{note.Title}.md");
});
app.MapRazorComponents<App>().AddInteractiveServerRenderMode();
app.Run();