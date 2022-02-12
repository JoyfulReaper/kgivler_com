using System.ComponentModel.DataAnnotations;

namespace Kgivler_com.Models
{
    public class PageHit
    {
        public int Id { get; set; }

        [StringLength(500)]
        public string Path { get; set; }
        public int Hits { get; set; }
    }
}
