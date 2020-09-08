'use strict';

const bunyan = require('bunyan');
const fs = require('fs');
const path = require('path');

const Snippet = require('../Models/Snippet');
const Manifest = require('../Models/Manifest');

const logger = bunyan.createLogger({
  name: 'TextExporter.AutoKey',
  level: 'debug',
  src: true,
});

const AutoKey = {
  modes: {
    ABBREVIATION: 1,
    HOTKEY: 3,
  },

  write: function(targetPath, index) {
    index.groups.forEach((group) => {
      let targetDir = path.join(targetPath, group.meta.title);
      let targetFile = null;

      if(!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir);
      }

      group.snippets.forEach((snippet) => {
        switch(snippet.type) {
          case Snippet.TYPE_JAVASCRIPT:
          case Snippet.TYPE_PYTHON:
          case Snippet.TYPE_SHELL_SCRIPT:
          case Snippet.TYPE_TEXT:
            // Transpose snippet.
            let transposedSnippet = this.transpose(snippet);

            // Ensure Unique Filenames
            transposedSnippet.label = this.getUniqueBasename(targetDir, transposedSnippet.label);

            // Write to filesystem
            this.writeSnippetMeta(targetDir, transposedSnippet);
            this.writeSnippetData(targetDir, transposedSnippet);

            // Since AutoKey only supports Python for scripting, wrap other
            // languages in Python when possible.
            if(snippet.type == Snippet.TYPE_JAVASCRIPT || snippet.type == Snippet.TYPE_SHELL_SCRIPT) {
              this.writeSnippetWrapper(targetDir, transposedSnippet);
            }
            break;

          default:
          case Snippet.TYPE_UNSUPPORTED:
          case Snippet.TYPE_APPLESCRIPT:
          case Snippet.TYPE_RICHTEXT:
            // Do nothing, not supported.
            break;
        }
      });
    });
  },

  /**
   * Writes the specified snippet metadata to the filesystem.
   *
   * @param {string} targetPath the target location in the filesystem
   * @param {Object} transposedSnippet the transposed snippet
   */
  writeSnippetMeta: function(targetPath, transposedSnippet) {
    let targetFile = `.${transposedSnippet.label}.json`;
    let target = path.join(targetPath, targetFile);
    fs.writeFileSync(target, JSON.stringify(transposedSnippet.meta));
    fs.write
  },

  /**
   * Writes the specified snippet data to the filesystem.
   *
   * @param {string} targetPath the target location in the filesystem
   * @param {Object} transposedSnippet the transposed snippet
   */
  writeSnippetData: function(targetPath, transposedSnippet) {
    let targetFile = `${transposedSnippet.label}.${transposedSnippet.ext}`;
    let target = path.join(targetPath, targetFile);
    fs.writeFileSync(target, transposedSnippet.data);
  },

  /**
   * Writes the specified snippet python wrapper to the filesystem.
   *
   * @param {string} targetPath the target location in the filesystem
   * @param {Object} transposedSnippet the transposed snippet
   */
  writeSnippetWrapper: function(targetPath, transposedSnippet) {
    let targetFile = `${transposedSnippet.label}.py`;
    let target = path.join(targetPath, targetFile);

    let wrappedScriptFile = `${transposedSnippet.label}.${transposedSnippet.ext}`;
    let wrappedScript = path.resolve(path.join(targetPath, wrappedScriptFile));

    let pythonWrapper = [
      'import subprocess',
      `out = subprocess.check_output(["${wrappedScript}"], universal_newlines=True).strip()`,
      'keyboard.send_keys(out)',
    ].join("\n");

    fs.writeFileSync(target, pythonWrapper);
  },

  /**
   * Determines a unique basename for snippet files using the specified path.
   *
   * @param {string} targetPath the path containing potential duplicate files
   * @param {string} basename the base filename to be used
   *
   * @return the resulting unique basename
   */
  getUniqueBasename: function(targetPath, basename) {
    let result = basename;
    let targetFile = `.${basename}.json`;
    let target = path.join(targetPath, targetFile);
    let i = 0;

    while(fs.existsSync(target)) {
      i++;
      result = `${basename}_${i}`
      targetFile = `.${result}.json`;
      target = path.join(targetPath, targetFile);
    }

    return result;
  },

  /**
   * Performs any necessary transformations on the snippet in preparation for
   * writing to the filesystem.
   *
   * @param {Models.Snippet} snippet the snippet to be transposed
   *
   * @return the transposed snippet
   */
  transpose: function(snippet) {
    logger.debug('Transposing incoming snippet.', snippet);
    const transposedSnippet = {
      label: this.transposeLabel(snippet.meta.title),
      ext: this.transposeExtension(snippet.type),
      meta: {
        type: this.transposeType(snippet.type),
        description: snippet.meta.title,
        modes: this.transposeModes(snippet),
        usageCount: snippet.meta.usageCount,
        prompt: snippet.output.prompt,
        omitTrigger: snippet.input.abbreviation.overwrite,
        matchCase: snippet.input.abbreviation.mode === Snippet.MODE_ADAPTIVE,
        showInTrayMenu: false,
        abbreviation: {
          abbreviations: this.transposeAbbreviations(snippet.input.abbreviation.text),
          backspace: snippet.input.abbreviation.overwrite,
          ignoreCase: snippet.input.abbreviation.mode === Snippet.MODE_CASE_INSENSITIVE,
          immediate: snippet.input.abbreviation.trigger !== null,
          triggerInside: snippet.input.abbreviation.trigger !== null,
          wordChars: snippet.input.abbreviation.trigger,
        },
        hotkey: {
          modifiers: snippet.input.hotkey.modifiers,
          hotKey: snippet.input.hotkey.key,
        },
        filter: {
          regex: snippet.output.windowFilter.regex,
          isRecursive: snippet.output.windowFilter.recursive,
        },
        sendMode: this.transposeSendMode(snippet.output.method),
      },
      data: snippet.data,
    };

    logger.debug('Snippet transposed.', transposedSnippet);

    // const jsonData = {
    //   type: 'phrase',                       // "phrase", "script"
    //   description: snippet.label,       // 1 -> Abbreviations, 3 -> Hotkey
    //   modes: [
    //     1
    //   ],
    //   usageCount: 0,
    //   prompt: false,                        // Always prompt before passing this phrase
    //   omitTrigger: true,                    // Omit trigger character
    //   matchCase: true,                      // Match phrase case to typed abbreviation
    //   showInTrayMenu: false,                // Show in notification icon menu
    //   abbreviation: {                       // Abbreviations
    //     abbreviations: [snippet.abbreviation.text],
    //     backspace: true,                    // Remove typed abbreviation
    //     ignoreCase: true,                   // Ignore case of typed abbreviation
    //     immediate: true,                    // Trigger immediately (don't require a trigger character)
    //     triggerInside: true,                // Trigger when typed as part of a word
    //     wordChars: "[\\w]",                 // Trigger on: All non-word -> "[\\w]", Space and Enter => "[^ \\n]", Tab => "[^\\t]"
    //   },
    //   hotkey: {                             // Hotkey
    //     modifiers: [],                      // <shift>, <ctrl>, <alt>, <super>, <hyper>, <meta>
    //     hotKey: null,
    //   },
    //   filter: {                             // Window Filter
    //     regex: null,
    //     isRecursive: false,
    //   },
    //   sendMode: "kb",                       // Keyboard -> "kb", Mouse Selection -> null, Clipboard -> "<ctrl>+v", "<ctrl>+<shift>+v", "<shift>+<insert>"
    // };


    return transposedSnippet;
  },

  transposeLabel: function(incomingTitle) {
    return incomingTitle.replace(/\W/g, '');
  },

  transposeExtension: function(incomingType) {
    switch(incomingType) {
      case Snippet.TYPE_JAVASCRIPT:
        return 'js';

      case Snippet.TYPE_PYTHON:
        return 'py';

      case Snippet.TYPE_SHELL_SCRIPT:
        return 'sh';

      case Snippet.TYPE_TEXT:
        return 'txt';

      default:
      case Snippet.TYPE_UNSUPPORTED:
        return null;
    }
  },

  transposeType: function(incomingType) {
    switch(incomingType) {
      case Snippet.TYPE_PYTHON:
        return 'script';

      default:
      case Snippet.TYPE_TEXT:
        return 'phrase';
    }
  },

  transposeModes: function(incomingSnippetData) {
    let result = [];

    if(incomingSnippetData.input.abbreviation.text !== null) {
      result.push(this.modes.ABBREVIATION);
    }

    if(incomingSnippetData.input.hotkey.key !== null) {
      result.push(this.modes.HOTKEY);
    }

    return result;
  },

  transposeAbbreviations: function(incomingAbbreviationText) {
    if(incomingAbbreviationText) {
      return [incomingAbbreviationText];
    } else {
      return [];
    }
  },

  transposeTriggerInside: function(incomingAbbreviationTrigger) {
    return incomingAbbreviationTrigger === null;
  },

  /**
   * Derives the correct send mode value from the output method.
   *
   * @param {string} incomingOutputMethod the Snippet.output.method value
   *
   * @returns {string} the transposed value
   */
  transposeSendMode: function(incomingOutputMethod) {
    switch(incomingOutputMethod) {
      case Snippet.METHOD_CLIPBOARD:
        return '<ctrl>+v';

      default:
      case Snippet.METHOD_KEYBOARD:
        // return 'kb';
        return '<ctrl>+v';
    }
  },
};

module.exports = AutoKey;
