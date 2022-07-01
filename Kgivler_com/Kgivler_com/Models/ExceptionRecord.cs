namespace kgivler_com.Models;

public class ExceptionRecord
{
    //public int ExceptionRecordId { get; set; }
    public string Message { get; set; } = null!;
    public string StackTrace { get; set; } = null!;
    public DateTime Date { get; set; }
}
