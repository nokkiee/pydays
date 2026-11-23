"""PyDays exercise checker.

Runs the learner's file with the stdin a test case gives, captures what it prints, then
evaluates the case's checks:
  out:  the printed output contains this text (whitespace-insensitive)
  re:   the printed output matches this regular expression
  expr: this Python expression is true in the program's namespace
        (_out holds the printed output, _lines its non-empty lines)
The result goes to the real stdout as one JSON line after a marker.
"""
import builtins
import contextlib
import io
import json
import os
import re
import sys
import traceback

MARK = "@@PYDAYS-RESULT@@"


def norm(text):
    return " ".join(str(text).split())


def short_repr(value, limit=200):
    try:
        r = repr(value)
    except Exception:
        r = "<?>"
    return r if len(r) <= limit else r[: limit - 1] + "…"


def trimmed_traceback(exc, filename):
    """The traceback without the checker's own frames."""
    te = traceback.TracebackException.from_exception(exc)
    te.stack = traceback.StackSummary.from_list([f for f in te.stack if f.filename == filename])
    return "".join(te.format()).strip()


def main():
    real_stdout = sys.stdout
    with open(sys.argv[1], encoding="utf-8") as f:
        spec = json.load(f)
    filename = spec["file"]
    with open(filename, encoding="utf-8") as f:
        source = f.read()

    sys.stdin = io.StringIO(spec.get("stdin") or "")
    sys.argv = [filename]
    # like `python file.py`: modules next to the program can be imported
    sys.path.insert(0, os.getcwd())
    captured = io.StringIO()
    namespace = {"__name__": "__main__", "__file__": filename, "__builtins__": builtins}
    error = None
    error_type = None
    with contextlib.redirect_stdout(captured):
        try:
            code = compile(source, filename, "exec")
            exec(code, namespace)
        except SystemExit:
            pass
        except SyntaxError as e:
            error_type = type(e).__name__
            error = "".join(traceback.format_exception_only(type(e), e)).strip()
        except BaseException as e:  # noqa: BLE001 - report anything the program raised
            error_type = type(e).__name__
            error = trimmed_traceback(e, filename)

    out = captured.getvalue()
    namespace["_out"] = out
    namespace["_lines"] = [line.strip() for line in out.splitlines() if line.strip()]

    checks = []
    for c in spec.get("checks", []):
        kind, value = c.get("type"), c.get("value", "")
        item = {"type": kind, "value": value, "ok": False}
        try:
            if kind == "out":
                item["ok"] = norm(value) in norm(out)
            elif kind == "re":
                item["ok"] = re.search(value, out, re.M) is not None
            elif kind == "expr":
                with contextlib.redirect_stdout(io.StringIO()):
                    result = eval(value, namespace)
                item["ok"] = bool(result)
                if not item["ok"]:
                    item["got"] = short_repr(result)
            else:
                item["detail"] = "unknown check type"
        except BaseException as e:  # noqa: BLE001
            item["detail"] = f"{type(e).__name__}: {e}"
        checks.append(item)

    result = {"out": out[-20000:], "error": error, "errorType": error_type, "checks": checks}
    real_stdout.write("\n" + MARK + json.dumps(result) + "\n")
    real_stdout.flush()


if __name__ == "__main__":
    main()
