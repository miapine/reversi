/*Include the static file webserver library*/

var static = require('node-static');

/*Include the http server library*/

var http = require('http');

/*assume we are running on heroku*/

var port = process.env.PORT;
var directory = __dirname + '/public';

/*if the server is not on heroku, readjust the port*/

if(typeof port == 'undefined' || !port){
	directory = './public';
	port = 8080;
}

/* Set up a static web server that will deliver files from the filesystem*/

var file = new static.Server(directory);

/*construct an http server that gets files from the file server*/

var app = http.createServer(
	function(request,response){
		request.addListener('end',
			function(){
				file.serve(request,response);
			}
		).resume();
	}
).listen(port);

console.log('The Server is running');