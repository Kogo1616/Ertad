using System.Text.Json.Serialization;
using Ertad.Api.Data;
using Ertad.Api.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
// SMS: "Dev" logs to the console (default); "Ubill" or "SenderGe" send real SMS.
// Real providers: 5 s to connect, 15 s in total.
var smsProvider = builder.Configuration["Sms:Provider"] ?? "Dev";
static SocketsHttpHandler SmsHandler() => new() { ConnectTimeout = TimeSpan.FromSeconds(5) };
switch (smsProvider)
{
    case "Ubill":
        var ubill = builder.Configuration.GetSection("Sms:Ubill").Get<UbillOptions>() ?? new();
        if (string.IsNullOrWhiteSpace(ubill.ApiKey) || ubill.BrandId <= 0)
            throw new InvalidOperationException("Sms:Ubill:ApiKey and Sms:Ubill:BrandId are required when Sms:Provider is Ubill");
        builder.Services.AddSingleton(ubill);
        builder.Services.AddHttpClient<ISmsSender, UbillSmsSender>(c => c.Timeout = TimeSpan.FromSeconds(15))
            .ConfigurePrimaryHttpMessageHandler(SmsHandler);
        break;
    case "SenderGe":
        var senderGe = builder.Configuration.GetSection("Sms:SenderGe").Get<SenderGeOptions>() ?? new();
        if (string.IsNullOrWhiteSpace(senderGe.ApiKey))
            throw new InvalidOperationException("Sms:SenderGe:ApiKey is required when Sms:Provider is SenderGe");
        builder.Services.AddSingleton(senderGe);
        builder.Services.AddHttpClient<ISmsSender, SenderGeSmsSender>(c => c.Timeout = TimeSpan.FromSeconds(15))
            .ConfigurePrimaryHttpMessageHandler(SmsHandler);
        break;
    case "Dev":
        builder.Services.AddSingleton<ISmsSender, DevSmsSender>();
        break;
    default:
        throw new InvalidOperationException($"Unknown Sms:Provider '{smsProvider}' (use Dev, Ubill or SenderGe)");
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
    await DbSeeder.SeedAsync(db, app.Configuration);
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
