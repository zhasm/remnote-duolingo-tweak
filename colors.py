import os

# Basic ANSI color codes and helpers.
# Supports disabling colors when NO_COLOR environment variable is set.

_NO_COLOR = bool(os.environ.get('NO_COLOR'))


def _join_args(*parts) -> str:
    """Join multiple arguments into a single string.

    Accepts any types and converts them to strings, joining with a space.
    """
    return ' '.join(str(p) for p in parts)


def _wrap(code: str, *parts) -> str:
    text = _join_args(*parts)
    if _NO_COLOR:
        return text
    return f"\033[{code}m{text}\033[0m"


def magenta(*parts) -> str:
    return _wrap('1;35', *parts)


def red(*parts) -> str:
    return _wrap('1;31', *parts)


def green(*parts) -> str:
    return _wrap('1;32', *parts)


def yellow(*parts) -> str:
    return _wrap('1;33', *parts)


def cyan(*parts) -> str:
    return _wrap('1;36', *parts)


__all__ = [
    'magenta',
    'red',
    'green',
    'yellow',
    'cyan',
]
