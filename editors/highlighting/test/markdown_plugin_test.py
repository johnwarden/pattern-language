"""Host tests for selection/lifecycle; native syntax scopes have a separate fixture."""

import ast
import importlib.util
from pathlib import Path
import re
import subprocess
import sys
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "sublime" / "PatternLanguage" / "pattern_markdown.py"
preferences = {}
windows = []
pending = []
available = set()
api = SimpleNamespace(
    load_settings=lambda name: preferences,
    windows=lambda: windows,
    set_timeout=lambda callback, delay: pending.append(callback),
    syntax_from_path=lambda path: SimpleNamespace(path=path) if path in available else None,
)
loader = importlib.util.spec_from_file_location("pattern_markdown_tested", PLUGIN)
with patch.dict(sys.modules, {
    "sublime": api,
    "sublime_plugin": SimpleNamespace(EventListener=object),
}):
    plugin = importlib.util.module_from_spec(loader)
    loader.loader.exec_module(plugin)


class Settings(dict):
    set = dict.__setitem__

    def erase(self, key):
        self.pop(key, None)


class View:
    def __init__(self, text="", path=plugin.MARKDOWN):
        self.text = text
        self.path = path
        self.options = Settings()
        self.changes = 0
        self.valid = True
        self.assign_syntax = Mock(side_effect=self.assign)

    def assign(self, path):
        self.path = path

    def syntax(self):
        return SimpleNamespace(path=self.path) if self.path else None

    def settings(self):
        return self.options

    def is_valid(self):
        return self.valid

    def change_count(self):
        return self.changes

    def find(self, pattern, start):
        return re.search(pattern, self.text[start:])


class MarkdownSelection(unittest.TestCase):
    def setUp(self):
        preferences.clear()
        windows.clear()
        pending.clear()
        available.clear()
        available.update((plugin.MARKDOWN, plugin.PATTERN_MARKDOWN))
        plugin._active = True

    def test_both_labels_and_marker_styles(self):
        for marker in ("```", "~~~"):
            for label in ("pattern", "pattern test", "pattern-language", "PATTERN TEST"):
                with self.subTest(marker=marker, label=label):
                    view = View("# Title\n\n" + marker + label + "\nassert True\n" + marker)
                    plugin._refresh(view)
                    self.assertEqual(view.path, plugin.PATTERN_MARKDOWN)
                    self.assertTrue(view.options[plugin.AUTO])
                    plugin._refresh(view)
                    self.assertEqual(view.assign_syntax.call_count, 1)

    def test_regular_markdown_and_other_languages_keep_their_syntax(self):
        for text in ("# Title", "```python\npass\n```", "```patterned\nx\n```"):
            view = View(text)
            plugin._refresh(view)
            view.assign_syntax.assert_not_called()
        for path in ("Packages/Other/Markdown.sublime-syntax", "Packages/PatternLanguage/PatternLanguage.sublime-syntax", None):
            view = View("```pattern test\nassert True", path)
            plugin._refresh(view)
            self.assertEqual(view.path, path)

    def test_removing_last_fence_restores_only_automatic_assignment(self):
        view = View("```pattern\nx = 1")
        plugin._refresh(view)
        view.text = "# Prose only"
        plugin._refresh(view)
        self.assertEqual(view.path, plugin.MARKDOWN)
        self.assertNotIn(plugin.AUTO, view.options)
        manual = View("# Prose", plugin.PATTERN_MARKDOWN)
        plugin._refresh(manual)
        self.assertEqual(manual.path, plugin.PATTERN_MARKDOWN)

    def test_global_and_view_opt_out(self):
        preferences[plugin.SETTING] = False
        view = View("```pattern\nx")
        plugin._refresh(view)
        view.assign_syntax.assert_not_called()
        view.options[plugin.SETTING] = True
        plugin._refresh(view)
        self.assertEqual(view.path, plugin.PATTERN_MARKDOWN)
        view.options[plugin.SETTING] = False
        plugin._refresh(view)
        self.assertEqual(view.path, plugin.MARKDOWN)

    def test_missing_or_disabled_markdown_dependency_is_not_assigned(self):
        for missing in (plugin.MARKDOWN, plugin.PATTERN_MARKDOWN):
            with self.subTest(missing=missing):
                available.discard(missing)
                view = View("```pattern test\nassert True")
                plugin._refresh(view)
                view.assign_syntax.assert_not_called()
                self.assertNotIn(plugin.AUTO, view.options)
                available.add(missing)
                plugin._refresh(view)
                self.assertEqual(view.path, plugin.PATTERN_MARKDOWN)

    def test_restore_waits_for_disabled_parent_to_be_available(self):
        view = View("```pattern\nx")
        plugin._refresh(view)
        available.remove(plugin.MARKDOWN)
        view.text = "# Prose only"
        view.assign_syntax.reset_mock()
        plugin._refresh(view)
        view.assign_syntax.assert_not_called()
        self.assertTrue(view.options[plugin.AUTO])
        available.add(plugin.MARKDOWN)
        plugin._refresh(view)
        self.assertEqual(view.path, plugin.MARKDOWN)
        self.assertNotIn(plugin.AUTO, view.options)

    def test_debounce_closed_views_and_unload(self):
        view = View("```pattern test\nassert True")
        listener = plugin.PatternLanguageMarkdownListener()
        listener.on_modified(view)
        view.changes += 1
        listener.on_modified(view)
        self.assertEqual(len(pending), 2)
        pending[0]()
        view.assign_syntax.assert_not_called()
        pending[1]()
        self.assertEqual(view.path, plugin.PATTERN_MARKDOWN)
        windows.append(SimpleNamespace(views=lambda: [view]))
        plugin.plugin_unloaded()
        self.assertEqual(view.path, plugin.MARKDOWN)
        plugin.plugin_loaded()
        self.assertEqual(view.path, plugin.PATTERN_MARKDOWN)
        view.valid = False
        listener.on_load(view)  # closed buffers are harmless

    def test_plugin_uses_sublime_embedded_python_compatible_syntax(self):
        ast.parse(PLUGIN.read_text(), feature_version=(3, 3))

    def test_package_contains_the_markdown_extension_and_loader(self):
        with TemporaryDirectory() as directory:
            output = Path(directory) / "PatternLanguage.sublime-package"
            subprocess.run(
                [sys.executable, str(ROOT / "package_sublime.py"), "--output", str(output)],
                check=True, capture_output=True, text=True,
            )
            with ZipFile(output) as archive:
                names = archive.namelist()
                for name in ("Markdown.sublime-syntax", "pattern_markdown.py", "PatternLanguage.sublime-syntax", "syntax_test_markdown-pattern.md"):
                    self.assertIn(name, names)
                self.assertFalse(any("/" in name for name in names))


if __name__ == "__main__":
    unittest.main()
