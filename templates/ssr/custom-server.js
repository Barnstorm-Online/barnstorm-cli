const
  fs = require('fs'),
  path = require('path'),
  LRU = require('lru-cache'),
  express = require('express'),
  compression = require('compression'),
  resolve = file => path.resolve(__dirname, 'www', file),
  { createBundleRenderer } = require('vue-server-renderer')

const
  app = express(),
  port = process.env.PORT || 3000,
  useMicroCache = process.env.MICRO_CACHE !== 'false',
  serverInfo =
    `express/${require('express/package.json').version} ` +
    `vue-server-renderer/${require('vue-server-renderer/package.json').version}`

const
  template = fs.readFileSync(resolve('../template.html'), 'utf-8'),
  bundle = require('./vue-ssr-server-bundle.json'),
  clientManifest = require('./vue-ssr-client-manifest.json')

// https://github.com/vuejs/vue/blob/dev/packages/vue-server-renderer/README.md#why-use-bundlerenderer
const renderer = createBundleRenderer(bundle, {
  template,
  clientManifest,
  // for component caching
  cache: LRU({
    max: 1000,
    maxAge: 1000 * 60 * 15
  }),
  basedir: resolve('.'),
  // recommended for performance
  runInNewContext: false
})

const serve = (path, cache) => express.static(resolve(path), {
  maxAge: cache ? 1000 * 60 * 60 * 24 * 30 : 0
})

app.use(compression({ threshold: 0 }))
app.use('/service-worker.js', serve('service-worker.js'))
app.use('/', serve('.', true))

app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html')
  res.setHeader('Server', serverInfo)

  const context = {
    url: req.url,
    req,
    res
  }

  renderer.renderToString(context, (err, html) => {
    if (err) {
      if (err.url) {
        res.redirect(err.url)
      }
      else if (err.code === 404) {
        res.status(404).send('404 | Page Not Found')
      }
      else {
        // Render Error Page or Redirect
        res.status(500).send('500 | Internal Server Error')
        console.error(`${req.url} -> error during render`)
        console.error(err.stack)
      }

      return
    }

    res.send(html)
  })
})

app.listen(port, () => {
  console.log(`server started at localhost:${port}`)
})
