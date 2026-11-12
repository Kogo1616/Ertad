using System.Text.Json.Serialization;
using Ertad.Api.Data;
using Ertad.Api.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
// SMS: "Dev" logs to the console (default); "SenderGe" sends real SMS through sender.ge.
if (builder.Configuration["Sms:Provider"] == "SenderGe")
{
    var senderGe = builder.Configuration.GetSection("Sms:SenderGe").Get<SenderGeOptions>() ?? new();
    if (string.IsNullOrWhiteSpace(senderGe.ApiKey))
        throw new InvalidOperationException("Sms:SenderGe:ApiKey is required when Sms:Provider is SenderGe");
    builder.Services.AddSingleton(senderGe);
    // Same limits as sender.ge's production example: 5 s to connect, 15 s in total.
    builder.Services.AddHttpClient<ISmsSender, SenderGeSmsSender>(c => c.Timeout = TimeSpan.FromSeconds(15))
        .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { ConnectTimeout = TimeSpan.FromSeconds(5) });
}
else
{
    builder.Services.AddSingleton<ISmsSender, DevSmsSender>();
}
builder.Services.AddScoped<Notifier>();
builder.Services.AddScoped<DealService>();
if (builder.Configuration.GetValue("Jobs:Enabled", true))
    builder.Services.AddHostedService<DealJob>();

// One cookie for everybody; the role claim says who you are (Buyer / StoreStaff / Admin).
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(o =>
    {
        o.Cookie.Name = "ertad";
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Lax;
        o.ExpireTimeSpan = TimeSpan.FromDays(30);
        o.SlidingExpiration = true;
        o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
        o.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
    });
builder.Services.AddAuthorization();

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var app = builder.Build();

if (app.Configuration.GetValue("Db:MigrateOnStartup", true))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await DbSeeder.SeedAsync(db);
}

Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "wwwroot", "uploads"));

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapFallbackToFile("index.html"); // serves the built React app (frontend → wwwroot)

app.Run();

public partial class Program;
