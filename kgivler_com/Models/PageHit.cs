using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace kgivler_com.Models
{
    public class PageHit
    {
        public int Id { get; set; }

        [StringLength(500)]
        public string Path { get; set; }
        public int Hits { get; set; }
    }
}
