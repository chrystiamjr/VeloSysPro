using System;
using System.Globalization;
using System.Text.RegularExpressions;

namespace VeloSysPro
{
    public sealed record ScheduleSpec(string Type, string Frequency, string Day, string Time);

    public static class SchedulePolicy
    {
        private const string Prefix = "VeloSysPro_";
        private static readonly string[] ValidTypes = { "quick", "full", "gaming", "revert" };
        private static readonly string[] ValidWeekdays =
        {
            "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN",
        };
        private static readonly Regex TimePattern =
            new(@"^([01]\d|2[0-3]):[0-5]\d$", RegexOptions.Compiled);

        public static ScheduleSpec Normalize(
            string? type,
            string? frequency,
            string? day,
            string? time
        )
        {
            string normalizedType = (type ?? "").ToLowerInvariant();
            if (Array.IndexOf(ValidTypes, normalizedType) < 0) normalizedType = "quick";

            string normalizedFrequency = (frequency ?? "").ToUpperInvariant();
            if (
                normalizedFrequency != "DAILY"
                && normalizedFrequency != "WEEKLY"
                && normalizedFrequency != "MONTHLY"
            )
                normalizedFrequency = "DAILY";

            string normalizedTime = time ?? "";
            if (!TimePattern.IsMatch(normalizedTime)) normalizedTime = "03:00";

            return new ScheduleSpec(
                normalizedType,
                normalizedFrequency,
                NormalizeDay(day ?? "", normalizedFrequency),
                normalizedTime
            );
        }

        public static string EncodeName(ScheduleSpec schedule)
        {
            string daySuffix = schedule.Day.Length == 0 ? "" : "_" + schedule.Day;
            return Prefix
                + Capitalize(schedule.Type)
                + "_"
                + Capitalize(schedule.Frequency)
                + daySuffix
                + "_"
                + schedule.Time.Replace(":", "");
        }

        public static ScheduleSpec? DecodeName(string name)
        {
            if (!name.StartsWith(Prefix, StringComparison.Ordinal)) return null;
            string[] parts = name.Substring(Prefix.Length)
                .Split('_', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 2) return null;

            string compactTime = parts.Length > 2 ? parts[^1] : "";
            string time = compactTime.Length == 4 ? compactTime.Insert(2, ":") : "";
            string day = parts.Length > 3 ? parts[2] : "";
            ScheduleSpec normalized = Normalize(parts[0], parts[1], day, time);

            return EncodeName(normalized) == name ? normalized : null;
        }

        private static string NormalizeDay(string day, string frequency)
        {
            if (frequency == "WEEKLY")
            {
                string weekday = day.ToUpperInvariant();
                return Array.IndexOf(ValidWeekdays, weekday) >= 0 ? weekday : "MON";
            }

            if (frequency == "MONTHLY")
            {
                bool parsed = int.TryParse(
                    day,
                    NumberStyles.Integer,
                    CultureInfo.InvariantCulture,
                    out int dayOfMonth
                );
                if (!parsed || dayOfMonth < 1 || dayOfMonth > 31) dayOfMonth = 1;
                return dayOfMonth.ToString(CultureInfo.InvariantCulture);
            }

            return "";
        }

        private static string Capitalize(string value) =>
            char.ToUpperInvariant(value[0]) + value.Substring(1).ToLowerInvariant();
    }
}
