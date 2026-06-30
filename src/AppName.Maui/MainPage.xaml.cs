using AppName.Maui.Bridge;

namespace AppName.Maui;

public partial class MainPage : ContentPage
{
    public MainPage(UsersBridge usersBridge)
    {
        InitializeComponent();
        HybridView.SetInvokeJavaScriptTarget(usersBridge);
    }
}
