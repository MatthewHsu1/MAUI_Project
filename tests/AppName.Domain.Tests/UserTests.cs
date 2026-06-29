using AppName.Domain.Entities;

namespace AppName.Domain.Tests;

public class UserTests
{
    [Fact]
    public void Rename_WithValidName_UpdatesName()
    {
        var user = new User(Guid.NewGuid(), "Old Name", "a@b.com");

        user.Rename("New Name");

        Assert.Equal("New Name", user.Name);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Rename_WithBlankName_Throws(string blank)
    {
        var user = new User(Guid.NewGuid(), "Old Name", "a@b.com");

        Assert.Throws<ArgumentException>(() => user.Rename(blank));
    }
}
