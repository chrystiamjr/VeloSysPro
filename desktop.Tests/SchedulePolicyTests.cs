using Xunit;

namespace VeloSysPro.Tests;

public class SchedulePolicyTests
{
    [Theory]
    [InlineData("quick", "DAILY", "", "03:00", "VeloSysPro_Quick_Daily_0300")]
    [InlineData("gaming", "WEEKLY", "MON", "04:30", "VeloSysPro_Gaming_Weekly_MON_0430")]
    [InlineData("full", "MONTHLY", "15", "02:00", "VeloSysPro_Full_Monthly_15_0200")]
    public void EncodeAndDecode_RoundTrip(
        string type,
        string frequency,
        string day,
        string time,
        string expectedName
    )
    {
        ScheduleSpec schedule = SchedulePolicy.Normalize(type, frequency, day, time);

        Assert.Equal(expectedName, SchedulePolicy.EncodeName(schedule));
        Assert.Equal(schedule, SchedulePolicy.DecodeName(expectedName));
    }

    [Fact]
    public void Normalize_ContainsInvalidInputBeforeItReachesAWindowsAdapter()
    {
        ScheduleSpec schedule = SchedulePolicy.Normalize("rm -rf", "YEARLY", "99", "99:99");

        Assert.Equal(new ScheduleSpec("quick", "DAILY", "", "03:00"), schedule);
    }

    [Theory]
    [InlineData("SomeOtherTask")]
    [InlineData("VeloSysPro_Quick_Weekly_XYZ_0300")]
    [InlineData("VeloSysPro_Quick_Daily_9999")]
    public void DecodeName_RejectsNamesOutsideCanonicalPolicy(string name)
    {
        Assert.Null(SchedulePolicy.DecodeName(name));
    }
}
