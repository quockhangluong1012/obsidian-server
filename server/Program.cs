using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Endpoints;
using Server.Services;

var builder = WebApplication.CreateBuilder(args);

var connStr = builder.Configuration.GetConnectionString("ObsidianDatabase");

var storageRoot = builder.Configuration["Storage:Root"] ?? "App_Data/files";

// Ensure data dirs exist
Directory.CreateDirectory(Path.Combine(builder.Environment.ContentRootPath, "App_Data"));
Directory.CreateDirectory(Path.Combine(builder.Environment.ContentRootPath, storageRoot));

// EF Core SQL Server
builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlServer(connStr));

// Storage provider: "Local" (default) writes to disk; "VercelBlob" uploads to Vercel Blob.
var storageProvider = builder.Configuration["Storage:Provider"] ?? "Local";
if (string.Equals(storageProvider, "VercelBlob", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.Configure<VercelBlobOptions>(builder.Configuration.GetSection(VercelBlobOptions.SectionName));
    builder.Services.AddHttpClient<VercelBlobAttachmentStorage>();
    builder.Services.AddScoped<IAttachmentStorage, VercelBlobAttachmentStorage>();
}
else
{
    builder.Services.AddScoped<IAttachmentStorage, LocalAttachmentStorage>();
}

builder.Services.AddScoped<FolderService>();
builder.Services.AddScoped<NoteService>();
builder.Services.AddScoped<AttachmentService>();
builder.Services.AddScoped<SearchService>();

builder.Services.AddCors(opt =>
{
    opt.AddPolicy("vite", p => p.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173", "https://client-psi-two-14.vercel.app/")
        .AllowAnyMethod().AllowAnyHeader().AllowCredentials());
});

builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// Ensure DB + Full-Text index (normal web mode)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.MigrateAndSeedAsync();
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
