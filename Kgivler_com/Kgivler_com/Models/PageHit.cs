namespace kgivler_com.Models;

public class PageHit
{
    public int Id { get; set; }
    public string Path { get; set; } = null!;
    public int Hits { get; set; }
}
