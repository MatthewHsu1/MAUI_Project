using AppName.Application.Dtos;
using AppName.Application.UseCases.Users;

namespace AppName.Maui.Bridge;

// Methods on this object are invoked from JavaScript via HybridWebView.
public sealed class UsersBridge
{
    private readonly GetUsersUseCase _getUsers;
    private readonly AddUserUseCase _addUser;

    public UsersBridge(GetUsersUseCase getUsers, AddUserUseCase addUser)
    {
        _getUsers = getUsers;
        _addUser = addUser;
    }

    public Task<IReadOnlyList<UserDto>> GetUsers() => _getUsers.ExecuteAsync();

    public Task<UserDto> AddUser(string name, string email) => _addUser.ExecuteAsync(name, email);
}
