using System;

namespace Ara3D.Utils;

public class UserAction<T>
{
    public string Header { get; init; }
    public Action<T> Execute { get; init; }
    public Func<T, bool>? CanExecute { get; init; }
    public Func<T, bool>? IsChecked { get; init; }
    public bool IsCheckable => IsChecked != null;
}

public static class UserAction
{
    public static UserAction<T> Create<T>(
            string header, 
            Action<T> executeAction,
            Func<T, bool>? canExecuteFunc = null,
            Func<T, bool>? isCheckedFunc = null)
    {
        return new()
        {
            CanExecute = canExecuteFunc,
            Execute = executeAction,
            IsChecked = isCheckedFunc,
            Header = header,
        };
    }
}