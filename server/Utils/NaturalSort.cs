using System.Text.RegularExpressions;

namespace Server.Utils;

/// <summary>
/// Sorts items by the first run of digits found in their name (e.g. folder "01-Foo" -> 1,
/// note "Chương 9. Bar" -> 9), falling back to plain alphabetical order for ties or names
/// without any digits (which sort after every numbered item).
/// </summary>
public static class NaturalSort
{
    private static readonly Regex LeadingNumber = new(@"\d+", RegexOptions.Compiled);

    public static IEnumerable<T> ByNamePrefix<T>(this IEnumerable<T> source, Func<T, string> nameSelector)
    {
        return source
            .Select(item => (Item: item, Name: nameSelector(item) ?? string.Empty))
            .OrderBy(x => ExtractNumber(x.Name))
            .ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .Select(x => x.Item);
    }

    private static long ExtractNumber(string name)
    {
        var m = LeadingNumber.Match(name);
        return m.Success && long.TryParse(m.Value, out var n) ? n : long.MaxValue;
    }
}
