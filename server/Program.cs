using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Endpoints;
using Server.Services;

var builder = WebApplication.CreateBuilder(args);

// Config: Storage root + Connection string (App_Data avoids case clash with Data/ code folder on Windows)
builder.Configuration.AddJsonFile("appsettings.json", optional: true);
var connStr = builder.Configuration.GetConnectionString("ObsidianDatabase")
    ?? "Server=(localdb)\\MSSQLLocalDB;Database=ObsidianDb;Trusted_Connection=True;TrustServerCertificate=True;";
var storageRoot = builder.Configuration["Storage:Root"] ?? "App_Data/files";

// Ensure data dirs exist
Directory.CreateDirectory(Path.Combine(builder.Environment.ContentRootPath, "App_Data"));
Directory.CreateDirectory(Path.Combine(builder.Environment.ContentRootPath, storageRoot));

// EF Core SQL Server
builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlServer(connStr));

builder.Services.AddScoped<FolderService>();
builder.Services.AddScoped<NoteService>();
builder.Services.AddScoped<AttachmentService>();
builder.Services.AddScoped<SearchService>();

builder.Services.AddCors(opt =>
{
    opt.AddPolicy("vite", p => p.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
        .AllowAnyMethod().AllowAnyHeader().AllowCredentials());
});

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddScoped<Server.Tools.VaultMigrator>();

var app = builder.Build();

// CLI inspect mode (temporary)
if (args.Length > 0 && args[0].Equals("inspect", StringComparison.OrdinalIgnoreCase))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.EnsureCreatedAndSeedAsync();
    await Server.Tools.Inspect.RunAsync(db);
    return;
}

if (args.Length > 0 && args[0].Equals("find-folder", StringComparison.OrdinalIgnoreCase) && args.Length > 1)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.EnsureCreatedAndSeedAsync();
    await Server.Tools.FindFolder.RunAsync(db, args[1]);
    return;
}

if (args.Length > 0 && args[0].Equals("dedupe-clr", StringComparison.OrdinalIgnoreCase) && args.Length > 1)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.EnsureCreatedAndSeedAsync();
    var n = await Server.Tools.DedupeClr.RunAsync(db, args[1]);
    Console.WriteLine($"[dedupe] deleted {n} duplicate notes");
    return;
}

// CLI migrate mode: dotnet run -- migrate --source "C:\path" [--wipe] [--no-rewrite] [--dry-run]
if (args.Length > 0 && args[0].Equals("migrate", StringComparison.OrdinalIgnoreCase))
{
    var source = args.FirstOrDefault(a => !a.StartsWith("-") && a != "migrate");
    // also support --source= or --source value
    for (int i = 0; i < args.Length; i++)
    {
        if (args[i] == "--source" && i + 1 < args.Length) source = args[i + 1];
        if (args[i].StartsWith("--source=")) source = args[i].Substring("--source=".Length).Trim('"');
    }
    source ??= @"C:\Users\luong.quockhang_amar\Documents\Obsidian Vault";
    var wipe = args.Contains("--wipe") || args.Contains("--clean");
    var dryRun = args.Contains("--dry-run");
    var noRewrite = args.Contains("--no-rewrite");
    var rewrite = !noRewrite;
    string? targetFolderId = null;
    for (int i = 0; i < args.Length; i++)
    {
        if (args[i] == "--target-folder-id" && i + 1 < args.Length) targetFolderId = args[i + 1];
        if (args[i].StartsWith("--target-folder-id=")) targetFolderId = args[i].Substring("--target-folder-id=".Length).Trim('"');
    }

    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.EnsureCreatedAndSeedAsync();
    var env = scope.ServiceProvider.GetRequiredService<IWebHostEnvironment>();
    var cfg = scope.ServiceProvider.GetRequiredService<IConfiguration>();
    var migrator = new Server.Tools.VaultMigrator(db, env, cfg);
    var res = await migrator.MigrateAsync(source!, wipe, rewrite, dryRun, Console.WriteLine, targetFolderId);
    Console.WriteLine($"[migrate] {(res.DryRun ? "DRY-RUN" : "DONE")} folders={res.Folders} notes={res.Notes} assets={res.Assets}");
    return;
}

// Ensure DB + Full-Text index (normal web mode)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.EnsureCreatedAndSeedAsync();
}

app.UseCors("vite");

// Health
app.MapGet("/health", () => Results.Ok(new { status = "ok", time = DateTime.UtcNow }));

// API endpoints
app.MapFolderEndpoints();
app.MapNoteEndpoints();
app.MapFileEndpoints();
app.MapSearchEndpoints();

// Serve Vite built static (client/dist) if exists, else fallback for dev
var clientDist = Path.Combine(builder.Environment.ContentRootPath, "..", "client", "dist");
if (Directory.Exists(clientDist))
{
    app.UseDefaultFiles(new DefaultFilesOptions { DefaultFileNames = { "index.html" }, RequestPath = "" });
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(clientDist),
        RequestPath = ""
    });
    // SPA fallback: serve index.html for non-/api routes
    app.MapFallback(async ctx =>
    {
        if (ctx.Request.Path.StartsWithSegments("/api") || ctx.Request.Path.StartsWithSegments("/health"))
        {
            ctx.Response.StatusCode = 404;
            return;
        }
        var index = Path.Combine(clientDist, "index.html");
        if (File.Exists(index))
        {
            ctx.Response.ContentType = "text/html";
            await ctx.Response.SendFileAsync(index);
        }
    });
}

app.Run();
