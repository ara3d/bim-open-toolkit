"""Feature=Compilation, Size=Small, Maturity=Review; isolated positive/negative builds.

Restore the compile-test project first. No existing project or generated input is edited.
"""
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE / 'csharp' / 'RecordContract.CompileTests.csproj'
LOGS = HERE.parents[4] / 'artifacts' / 'bim-contract-records'


def run(name, args, diagnostic=None):
    print(f'Checking {name}...', flush=True)
    result = subprocess.run(['dotnet', *args], capture_output=True, text=True, timeout=180)
    LOGS.mkdir(parents=True, exist_ok=True)
    (LOGS / (name+'.log')).write_text(result.stdout+result.stderr, encoding='utf-8')
    if diagnostic is None:
        if result.returncode != 0:
            raise RuntimeError(result.stdout+result.stderr)
    elif result.returncode == 0 or f'error {diagnostic}:' not in result.stdout+result.stderr:
        raise RuntimeError(f'Expected {diagnostic} rejection:\n'+result.stdout+result.stderr)
    print(f'{name}: passed', flush=True)


def main():
    run('positive', ['run','--no-restore','--project',str(PROJECT)])
    for symbol, code in [('WRONG_REFERENCE','CS0029'), ('WRONG_SNAPSHOT_REFERENCE','CS0029'), ('ANALYZER_PROBE','PURE002')]:
        run(symbol.lower(), ['build',str(PROJECT),'--no-restore','--no-incremental','-p:DefineConstants='+symbol], code)
    # Negative builds alter compiler options; leave a successful normal build behind.
    run('normal_after_probes', ['build',str(PROJECT),'--no-restore','--no-incremental'])
    print(f'C# integration checks passed. Logs: {LOGS}')


if __name__ == '__main__':
    main()
