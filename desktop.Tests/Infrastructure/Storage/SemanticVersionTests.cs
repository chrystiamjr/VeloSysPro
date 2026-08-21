using System;
using Xunit;

namespace VeloSysPro.Tests
{
    public class SemanticVersionTests
    {
        [Theory]
        [InlineData("0.2.0", 0, 2, 0, "", "")]
        [InlineData("v1.2.3", 1, 2, 3, "", "")]
        [InlineData("2.0.0-beta.1", 2, 0, 0, "beta.1", "")]
        [InlineData("v2.1.0-preview.2+build.123", 2, 1, 0, "preview.2", "build.123")]
        public void TryParse_ParsesValidSemVerStrings(
            string input,
            int major,
            int minor,
            int patch,
            string prerelease,
            string build
        )
        {
            bool ok = SemanticVersion.TryParse(input, out SemanticVersion? version);

            Assert.True(ok);
            Assert.NotNull(version);
            Assert.Equal(major, version!.Major);
            Assert.Equal(minor, version.Minor);
            Assert.Equal(patch, version.Patch);
            Assert.Equal(prerelease, version.PreRelease);
            Assert.Equal(build, version.BuildMetadata);
        }

        [Theory]
        [InlineData("not-a-version")]
        [InlineData("")]
        [InlineData("1")]
        [InlineData(null)]
        public void TryParse_RejectsInvalidStrings(string? input)
        {
            bool ok = SemanticVersion.TryParse(input, out SemanticVersion? version);
            Assert.False(ok);
            Assert.Null(version);
        }

        [Fact]
        public void CompareTo_OrdersCorrectly()
        {
            var v01 = SemanticVersion.Parse("0.1.0");
            var v02 = SemanticVersion.Parse("0.2.0");
            var v02Pre = SemanticVersion.Parse("0.2.0-beta.1");
            var v10 = SemanticVersion.Parse("1.0.0");

            Assert.True(v02 > v01);
            Assert.True(v10 > v02);
            // Release is greater than pre-release of the same version
            Assert.True(v02 > v02Pre);
            Assert.True(v02Pre < v02);
            Assert.True(v01 < v02Pre);
        }

        [Fact]
        public void FromAssembly_ReturnsValidVersion()
        {
            var version = SemanticVersion.FromAssembly(typeof(AppPaths).Assembly);
            Assert.NotNull(version);
            Assert.True(version.Major >= 0);
            Assert.False(string.IsNullOrWhiteSpace(version.ToString()));
        }
    }
}
