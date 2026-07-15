using AppName.Maui.Bridge;

namespace AppName.Maui;

public partial class MainPage : ContentPage
{
    public MainPage(AppBridge appBridge)
    {
        InitializeComponent();
        HybridView.SetInvokeJavaScriptTarget(appBridge);
    }
}
