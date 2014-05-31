var connect = require('connect');
var serveStatic = require('serve-static');

var app = connect();

app.use(serveStatic('public/wbgds', {'index': ['default.html', 'index.html']}));
app.listen(3000);

console.log('local server started at: 3000');