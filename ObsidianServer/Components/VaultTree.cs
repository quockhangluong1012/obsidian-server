using Microsoft.AspNetCore.Components;
using ObsidianServer.Features.Attachments;
using ObsidianServer.Features.Workspace;

namespace ObsidianServer.Components;

public enum VaultNodeKind { Folder, Note, Attachment }

/// <summary>A folder/note/attachment being dragged, or the target under the pointer.</summary>
public sealed record DragItem(Guid Id, VaultNodeKind Kind, string Name);

/// <summary>Where a right-click or long-press should open the shared context menu.</summary>
public sealed record MenuRequest(double X, double Y, VaultNodeKind Kind, Guid Id, string Name);

/// <summary>
/// Shared state for the recursive <see cref="FileTree"/> explorer: the folder/note/attachment
/// hierarchy, expansion and selection, the inline "new/rename folder" row, drag-and-drop, and the
/// callbacks back to the page.
/// </summary>
public sealed class VaultTree
{
    private static readonly List<FolderSummary> NoFolders = [];
    private static readonly List<NoteSummary> NoNotes = [];
    private static readonly List<AttachmentSummary> NoAttachments = [];

    private readonly Dictionary<Guid, List<FolderSummary>> childFolders = [];
    private readonly Dictionary<Guid, List<NoteSummary>> folderNotes = [];
    private readonly Dictionary<Guid, List<AttachmentSummary>> folderAttachments = [];
    private List<FolderSummary> rootFolders = [];
    private List<NoteSummary> rootNotes = [];
    private List<AttachmentSummary> rootAttachments = [];

    public required EventCallback<Guid> ToggleFolder { get; init; }
    public required EventCallback<Guid> SelectFolder { get; init; }
    public required EventCallback<Guid> OpenNote { get; init; }
    public required EventCallback<Guid> OpenAttachment { get; init; }
    public required EventCallback<string> CommitFolderDraft { get; init; }
    public required EventCallback CancelFolderDraft { get; init; }
    public required EventCallback<MenuRequest> ShowMenu { get; init; }
    public required EventCallback<DragItem> BeginDrag { get; init; }
    public required EventCallback EndDrag { get; init; }
    public required EventCallback<Guid?> Drop { get; init; }

    public HashSet<Guid> Expanded { get; } = [];
    public Guid? ActiveNoteId { get; set; }
    public Guid? ActiveFolderId { get; set; }
    public Guid? OpenAttachmentId { get; set; }

    public bool CreatingFolder { get; set; }
    public Guid? NewFolderParentId { get; set; }
    public Guid? RenamingFolderId { get; set; }
    public string RenamingInitialName { get; set; } = string.Empty;

    public DragItem? Dragging { get; set; }
    public Guid? DragOverFolderId { get; set; }
    public bool DragOverRoot { get; set; }

    /// <summary>Groups the vault into a hierarchy; notes sort by recency or by title.</summary>
    public void Load(IReadOnlyList<FolderSummary> folders, IReadOnlyList<NoteSummary> notes, IReadOnlyList<AttachmentSummary> attachments, bool recentFirst)
    {
        childFolders.Clear();
        folderNotes.Clear();
        folderAttachments.Clear();
        rootFolders = [.. folders.Where(folder => folder.ParentId is null).OrderBy(folder => folder.Name, StringComparer.CurrentCultureIgnoreCase)];

        foreach (var group in folders.Where(folder => folder.ParentId is not null).GroupBy(folder => folder.ParentId!.Value))
            childFolders[group.Key] = [.. group.OrderBy(folder => folder.Name, StringComparer.CurrentCultureIgnoreCase)];

        NoteSummary[] SortNotes(IEnumerable<NoteSummary> items) => recentFirst
            ? [.. items.OrderByDescending(note => note.UpdatedAt)]
            : [.. items.OrderBy(note => note.Title, StringComparer.CurrentCultureIgnoreCase)];

        rootNotes = [.. SortNotes(notes.Where(note => note.FolderId is null))];
        foreach (var group in notes.Where(note => note.FolderId is not null).GroupBy(note => note.FolderId!.Value))
            folderNotes[group.Key] = [.. SortNotes(group)];

        rootAttachments = [.. attachments.Where(attachment => attachment.FolderId is null).OrderBy(attachment => attachment.FileName, StringComparer.CurrentCultureIgnoreCase)];
        foreach (var group in attachments.Where(attachment => attachment.FolderId is not null).GroupBy(attachment => attachment.FolderId!.Value))
            folderAttachments[group.Key] = [.. group.OrderBy(attachment => attachment.FileName, StringComparer.CurrentCultureIgnoreCase)];
    }

    public IReadOnlyList<FolderSummary> Subfolders(Guid? parentId) => parentId is Guid id
        ? childFolders.TryGetValue(id, out var children) ? children : NoFolders
        : rootFolders;

    public IReadOnlyList<NoteSummary> NotesIn(Guid? folderId) => folderId is Guid id
        ? folderNotes.TryGetValue(id, out var notes) ? notes : NoNotes
        : rootNotes;

    public IReadOnlyList<AttachmentSummary> AttachmentsIn(Guid? folderId) => folderId is Guid id
        ? folderAttachments.TryGetValue(id, out var items) ? items : NoAttachments
        : rootAttachments;

    public bool IsExpanded(Guid folderId) => Expanded.Contains(folderId);

    public bool ShowsNewFolderRow(Guid? parentId) => CreatingFolder && NewFolderParentId == parentId;

    public bool IsRenamingFolder(Guid folderId) => RenamingFolderId == folderId;
}
