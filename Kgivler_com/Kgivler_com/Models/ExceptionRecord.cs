using System.ComponentModel.DataAnnotations;

namespace Kgivler_com.Models
{
    public class ExceptionRecord
    {
        public int ExceptionRecordId { get; set; }

        [StringLength(1000)]
        public string Message { get; set; } = string.Empty;

        [StringLength(3000)]
        public string StackTrace { get; set; } = string.Empty;
    }
}
