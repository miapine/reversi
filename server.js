/*Include the static file webserver library*/



//set up the static file server
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

//set up the web socket server

//A registry of socketIds and player info

var players = [];


var io = require('socket.io').listen(app);

io.sockets.on('connection', function (socket){
	log('Client connection by ' +socket.id);



	function log(){
		var array = ['*** Server Log Message: '];
		for(var i = 0; i<arguments.length; i++){
			array.push(arguments[i]);
			console.log(arguments[i]);

		}
		socket.emit('log',array);
		socket.broadcast.emit('log',array);
	}

	
	
	


	/*join room command
	/*payload:
		{
			'room': room to join.
			'username': username of person joining
		}
		join_room_response:
		{
			result: 'success'
			'room': room joined,
			'username' : username that joined
			'socket_id': the socket id of the person that joined,
			'membership' : number of people that joined including new member

		}
		or
		{
			result: 'fail'
			'room': failure message
		}
	*/
	socket.on('join_room', function(payload){
		log('\'join_room\' command'+JSON.stringify(payload));

		/*check that the client sent a payload*/
		if(('undefined' === typeof payload) || !payload){
			var error_message = 'join_room had no payload, command aborted';
			log(error_message);
			socket.emit('join_room_response', {
						result: 'fail',
						message: error_message
			});

			return;

		}
		/*check that the payload has a room to join*/

		var room = payload.room;

		if(('undefined' === typeof room) || !room){
			var error_message = 'join_room didn\'t specify a room, command aborted';
			log(error_message);
			socket.emit('join_room_response', {
						result: 'fail',
						message: error_message
			});

			return;

		}
		/*check that a username has been provided*/

		var username = payload.username;

		if(('undefined' === typeof username) || !username){
			var error_message = 'join_room didn\'t specify a username, command aborted';
			log(error_message);
			socket.emit('join_room_response', {
						result: 'fail',
						message: error_message
			});

			return;

		}
		/*Store info about the new player*/
		players[socket.id]={};
		players[socket.id].username = username;
		players[socket.id].room = room;

		/*actually join the room*/
		socket.join(room);

		var roomObject = io.sockets.adapter.rooms[room];

		/*tell everyone that is in the room that someone just joined*/
		var numClients = roomObject.length;
		var success_data = {
								result: 'success',
								room: room,
								username: username,
								socket_id: socket.id,
								membership: numClients
		};

		io.in(room).emit('join_room_response',success_data);

		for(var socket_in_room in roomObject.sockets){
			var success_data = {
								result: 'success',
								room: room,
								username: players[socket_in_room].username,
								socket_id: socket_in_room,
								membership: numClients
			};
			socket.emit('join_room_response',success_data);
		}

		log('join_room success');

	});


		socket.on('disconnect', function(){
		log('Client disconnected '+JSON.stringify(players[socket.id]));

		if('undefined' !== typeof players[socket.id] && players[socket.id]){
			var username = players[socket.id].username;
			var room = players[socket.id].room;
			var payload = {
							username: username,
							socket_id: socket.id
							};
			delete players[socket.id];
			io.in(room).emit('player_disconnected',payload);
		}

	});


	/*send messaage command
	/*payload:
		{
			'room': room to join.
			'message': the message to send
		}
		send_message_response:
		{
			'result': 'success'
			'username' : username that spoke
			'message' : the message that was sent

		}
		or
		{
			result: 'fail'
			'room': failure message
		}
	*/

	socket.on('send_message', function(payload){
		log('the server recieve a command', 'send_message', payload);
		if(('undefined' === typeof payload) || !payload){
			var error_message = 'send_message had no payload, command aborted';
			log(error_message);
			socket.emit('send_message_response', {
						result: 'fail',
						message: error_message
			});

			return;

		}

		var room = payload.room;

		if(('undefined' === typeof room) || !room){
			var error_message = 'send_message didn\'t specify a room, command aborted';
			log(error_message);
			socket.emit('send_message_response', {
						result: 'fail',
						message: error_message
			});

			return;

		}

		var username = players[socket.id].username;

		if(('undefined' === typeof username) || !username){
			var error_message = 'send_message didn\'t specify a username, command aborted';
			log(error_message);
			socket.emit('send_message_response', {
						result: 'fail',
						message: error_message
			});

			return;

		}

		var message = payload.message;

		if(('undefined' === typeof message) || !message){
			var error_message = 'send_message didn\'t specify a message, command aborted';
			log(error_message);
			socket.emit('send_message_response', {
						result: 'fail',
						message: error_message
			});

			return;

		}

		var success_data = {
								result: 'success',
								room: room,
								username: username,
								message: message
							};
		io.in(room).emit('send_message_response',success_data);
		log('Message sent to room '+room+ ' by ' +username);




	});

		/*invite command
		/*payload:
		{
			
			'requested_user': socket id of the person to be invited
		}
		invite_response:
		{
			'result': 'success'
			'socket_id' : the socket id of the person being ivited

		}
		or
		{
			result: 'fail'
			'message': failure message
		}

		invited:
		{
			'result': 'success'
			'socket_id' : the socket id of the person being ivited

		}
		or
		{
			result: 'fail'
			'message': failure message
		}
	*/

	socket.on('invite', function(payload){
		log('invite with '+JSON.stringify(payload));

		if(('undefined' === typeof payload) || !payload){
			var error_message = 'invite had no payload, command aborted';
			log(error_message);
			socket.emit('invite_response', {
						result: 'fail',
						message: error_message
			});

			return;

		}

		var username = players[socket.id].username;

		if(('undefined' === typeof username) || !username){
			var error_message = 'invite can\'t identify who sent the message, command aborted';
			log(error_message);
			socket.emit('invite_response', {
						result: 'fail',
						message: error_message
			});

			return;

		}

		var requested_user = payload.requested_user;

		if(('undefined' === typeof requested_user) || !requested_user){
			var error_message = 'invite didn\'t specify a a requested_user, command aborted';
			log(error_message);
			socket.emit('invite_response', {
						result: 'fail',
						message: error_message
			});

			return;

		}

		var room = players[socket.id].room;
		var roomObject = io.sockets.adapter.rooms[room];

		/*make sure the user being invited is in the room*/
		if(!roomObject.sockets.hasOwnProperty(requested_user)){
			var error_message = 'invite requested a user that wasn\'t in the room, command aborted';
			log(error_message);
			socket.emit('invite_response', {
						result: 'fail',
						message: error_message
			});

			return;
		}

		/*if we get to here, respond to the inviter that we were successful*/

		var success_data = {
								result: 'success',
								socket_id: requested_user
							};
		socket.emit('invite_response', success_data);
		
		/*tell the invitee that they have been invited*/

		var success_data = {
							result: 'success',
							socket_id: socket.id
						};

		socket.to(requested_user).emit('invited', success_data);
		log('invite successful');


	});

		/*uninvite command
		/*payload:
		{
			
			'requested_user': socket id of the person to be uninvited
		}
		uninvite_response:
		{
			'result': 'success'
			'socket_id' : the socket id of the person being univited

		}
		or
		{
			result: 'fail'
			'message': failure message
		}

		uninvited:
		{
			'result': 'success'
			'socket_id' : the socket id of the person doing the univited

		}
		or
		{
			result: 'fail'
			'message': failure message
		}
	*/

	socket.on('uninvite', function(payload){
		log('uninvite with '+JSON.stringify(payload));

		if(('undefined' === typeof payload) || !payload){
			var error_message = 'uninvite had no payload, command aborted';
			log(error_message);
			socket.emit('uninvite_response', {
						result: 'fail',
						message: error_message
			});

			return;

		}

		var username = players[socket.id].username;

		if(('undefined' === typeof username) || !username){
			var error_message = 'uninvite can\'t identify who sent the message, command aborted';
			log(error_message);
			socket.emit('uninvite_response', {
						result: 'fail',
						message: error_message
			});

			return;

		}

		var requested_user = payload.requested_user;

		if(('undefined' === typeof requested_user) || !requested_user){
			var error_message = 'uninvite didn\'t specify a a requested_user, command aborted';
			log(error_message);
			socket.emit('uninvite_response', {
						result: 'fail',
						message: error_message
			});

			return;

		}

		var room = players[socket.id].room;
		var roomObject = io.sockets.adapter.rooms[room];

		/*make sure the user being invited is in the room*/
		if(!roomObject.sockets.hasOwnProperty(requested_user)){
			var error_message = 'invite requested a user that wasn\'t in the room, command aborted';
			log(error_message);
			socket.emit('invite_response', {
						result: 'fail',
						message: error_message
			});

			return;
		}

		/*if we get to here, respond to the inviter that we were successful*/

		var success_data = {
								result: 'success',
								socket_id: requested_user
							};
		socket.emit('uninvite_response', success_data);
		
		/*tell the uninvitee that they have been invited*/

		var success_data = {
							result: 'success',
							socket_id: socket.id
						};

		socket.to(requested_user).emit('uninvited', success_data);
		log('uninvite successful');


	});

		/*game_start command
		/*payload:
		{
			
			'requested_user': socket id of the person to be played with
		}
		uninvite_response:
		{
			'result': 'success'
			'socket_id' : the socket id of the person you are playing
			'game_id': id of the game session

		}
		or
		{
			result: 'fail'
			'message': failure message
		}
	*/

	socket.on('game_start', function(payload){
	log('game_start with '+JSON.stringify(payload));

	if(('undefined' === typeof payload) || !payload){
		var error_message = 'game_start had no payload, command aborted';
		log(error_message);
		socket.emit('game_start_response', {
					result: 'fail',
					message: error_message
		});

		return;

	}

	var username = players[socket.id].username;

	if(('undefined' === typeof username) || !username){
		var error_message = 'game_start can\'t identify who sent the message, command aborted';
		log(error_message);
		socket.emit('game_start_response', {
					result: 'fail',
					message: error_message
		});

		return;

	}

	var requested_user = payload.requested_user;

	if(('undefined' === typeof requested_user) || !requested_user){
		var error_message = 'game_start didn\'t specify a a requested_user, command aborted';
		log(error_message);
		socket.emit('game_start_response', {
					result: 'fail',
					message: error_message
		});

		return;

	}

	var room = players[socket.id].room;
	var roomObject = io.sockets.adapter.rooms[room];

	/*make sure the user being invited is in the room*/
	if(!roomObject.sockets.hasOwnProperty(requested_user)){
		var error_message = 'game_start requested a user that wasn\'t in the room, command aborted';
		log(error_message);
		socket.emit('game_start_response', {
					result: 'fail',
					message: error_message
		});

		return;
	}

	/*if we get to here, respond to the game starter that we were successful*/
	var game_id = Math.floor((1+Math.random())*0x10000).toString(16).substring(1);
	var success_data = {
							result: 'success',
							socket_id: requested_user,
							game_id: game_id
						};
	socket.emit('game_start_response', success_data);
	
	/*tell the other player to play*/

	var success_data = {
						result: 'success',
						socket_id: socket.id,
						game_id: game_id
					};

	socket.to(requested_user).emit('game_start_response', success_data);
	log('game_start successful');


	});

});
