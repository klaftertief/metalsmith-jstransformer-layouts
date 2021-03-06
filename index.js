var jstransformer = require('jstransformer')
var toTransformer = require('inputformat-to-jstransformer')
var extend = require('extend')
var path = require('path')
var async = require('async')

var transformers = {}

/**
 * Retrieve the JSTransformer from the given name.
 *
 * @return The JSTransformer; false if it doesn't exist.
 */
function getTransformer (name) {
  if (name in transformers) {
    return transformers[name]
  }
  var transformer = toTransformer(name)
  transformers[name] = transformer ? jstransformer(transformer) : false
  return transformers[name]
}

module.exports = function (opts) {
  // Execute the plugin.
  return function (files, metalsmith, done) {
    // Retrieve all layouts.
    var layouts = []
    var content = []
    var templates = {}
    for (var filename in files) {
      var layoutName = files[filename].layout
      if (layoutName && layoutName in files) {
        layouts.push(layoutName)
        content.push(filename)
      }
    }

    /**
     * Compile the given layout and store it in templates.
     */
    function compileLayout (layout, done) {
      var transform = path.extname(layout).substring(1)
      transform = getTransformer(transform)
      if (transform) {
        var options = extend({}, files[layout], {
          filename: path.join(metalsmith._directory, metalsmith._source, layout)
        })
        transform.compileAsync(files[layout].contents.toString(), options).then(function (results) {
          templates[layout] = results
          done()
        }, function (err) {
          done(err)
        })
      } else {
        done('The layout ' + layout + ' has an unsupported transform of ' + transform + '.')
      }
    }

    /**
     * Render the given file in its layout templates.
     */
    function renderContent (file, done) {
      var layoutName = files[file].layout
      while (layoutName && templates[layoutName]) {
        // Build the options/locals.
        var locals = extend({}, metalsmith.metadata(), files[layoutName], files[file], {
          contents: files[file].contents.toString(),
          filename: path.join(metalsmith._directory, metalsmith._source, layoutName)
        })
        var output = templates[layoutName].fn(locals)
        files[file].contents = output
        layoutName = files[layoutName].layout
      }
      done()
    }

    // Compile all layouts.
    async.map(layouts, compileLayout, function (err) {
      if (err) {
        done(err)
      } else {
        // Now that the layouts are available, render the content.
        async.mapSeries(content, renderContent, done)
      }
    })
  }
}
