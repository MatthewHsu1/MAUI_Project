namespace AppName.Domain.Entities;

public sealed class User
{
    public User(Guid id, string name, string email)
    {
        Id = id;
        Name = name;
        Email = email;
    }

    public Guid Id { get; }
    public string Name { get; private set; }
    public string Email { get; }

    public void Rename(string newName)
    {
        if (string.IsNullOrWhiteSpace(newName))
            throw new ArgumentException("Name cannot be blank.", nameof(newName));
        Name = newName;
    }
}
