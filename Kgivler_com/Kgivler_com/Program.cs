using Kgivler_com.Data;
using Kgivler_com.Infrastructure;
using Kgivler_com.Middleware;
using Kgivler_com.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();
builder.Services.AddDbContext<ApplicationDbContext>(opts =>
{
    opts.UseSqlServer(
        builder.Configuration.GetConnectionString("Default"));
});

builder.Services.AddScoped<IHitCounterService, HitCounterService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseMiddleware<UAMiddleware>();

app.UseAuthorization();

app.MapRazorPages();

DatabaseSeeder.EnsurePopulated(app);

app.Run();
