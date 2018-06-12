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

		if(room !== 'lobby'){
			send_game_update(socket,room,'initial update');
		}

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



		/*play token command
		/*payload:
		{
			
			'row': 0-7
			'column': 0-7
			'color': 'white' or 'black'
		}
		if succesfuly a success message will be followed by a game update message
		play_token_response
		{
			'result': 'success'

		}
		or
		{
			result: 'fail'
			'message': failure message
		}
	*/

	socket.on('play_token', function(payload){
	log('play_token with '+JSON.stringify(payload));

	if(('undefined' === typeof payload) || !payload){
		var error_message = 'play_token had no payload, command aborted';
		log(error_message);
		socket.emit('play_token_response', {
					result: 'fail',
					message: error_message
		});

		return;

	}

	var player = players[socket.id];

	if(('undefined' === typeof player) || !player){
		var error_message = 'server can\'t recognize you try going back one screen, command aborted';
		log(error_message);
		socket.emit('play_token_response', {
					result: 'fail',
					message: error_message
		});

		return;

	}

	var username = players[socket.id].username;

	if(('undefined' === typeof username) || !username){
		var error_message = 'play token can\'t identify who sent the message, command aborted';
		log(error_message);
		socket.emit('play_token_response', {
					result: 'fail',
					message: error_message
		});

		return;

	}

	var player = players[socket.id];

	if(('undefined' === typeof player) || !player){
		var error_message = 'server can\'t recognize you try going back one screen, command aborted';
		log(error_message);
		socket.emit('play_token_response', {
					result: 'fail',
					message: error_message
		});

		return;

	}

	var game_id = players[socket.id].room;

	if(('undefined' === typeof game_id) || !game_id){
		var error_message = 'play token cant find your game board, command aborted';
		log(error_message);
		socket.emit('play_token_response', {
					result: 'fail',
					message: error_message
		});

		return;

	}

	var row = payload.row;

	if(('undefined' === typeof row) || row <0 || row>7){
		var error_message = 'play token didnt specify a valid row, command aborted';
		log(error_message);
		socket.emit('play_token_response', {
					result: 'fail',
					message: error_message
		});

		return;

	}

	var column = payload.column;

	if(('undefined' === typeof column) || column <0 || column>7){
		var error_message = 'play token didnt specify a valid colunm, command aborted';
		log(error_message);
		socket.emit('play_token_response', {
					result: 'fail',
					message: error_message
		});

		return;

	}

	var color = payload.color;

	if(('undefined' === typeof color) || !color || (color != 'white' && color != 'black')){
		var error_message = 'play token didnt specify a valid color, command aborted';
		log(error_message);
		socket.emit('play_token_response', {
					result: 'fail',
					message: error_message
		});

		return;

	}

	var game = games[game_id];

	if(('undefined' === typeof game) || !game){
		var error_message = 'play token couldnt find your game board, command aborted';
		log(error_message);
		socket.emit('play_token_response', {
					result: 'fail',
					message: error_message
		});

		return;

	}
	//current attempt is out of turn
	if(color != game.whose_turn){
		var error_message = 'play token message played out of turn, command aborted';
		log(error_message);
		socket.emit('play_token_response', {
					result: 'fail',
					message: error_message
		});
		return;

	}
	// if the wrong socket is playing the color
	if(
		((game.whose_turn === 'white') && (game.player_white.socket != socket.id)) ||
 		((game.whose_turn === 'black') && (game.player_black.socket != socket.id))
	){


		var error_message = 'play token turn played by wrong player, command aborted';
		log(error_message);
		socket.emit('play_token_response', {
					result: 'fail',
					message: error_message
		});
		return;
	}


	/*sending response*/
	var success_data = {
						result: 'success',
						};
	socket.emit('play_token_response',success_data);

	//execute the moves

	if(color == 'white'){
		game.board[row][column] = 'w';
		flip_board('w',row,column,game.board);
		game.whose_turn = 'black';
		game.legal_moves = calculate_valid_moves('b',game.board);

	}
	else if(color == 'black'){
		game.board[row][column] = 'b';
		flip_board('b',row,column,game.board);
		game.whose_turn = 'white';
		game.legal_moves = calculate_valid_moves('w',game.board);
	}

	var d = new Date();
	game.last_move_time = d.getTime();

	send_game_update(socket,game_id,'played a token');


	});

});

/*********************************************/
/*			Code related to the game state */

var games = [];

function create_new_game(){
	var new_game ={};
	new_game.player_white ={};
	new_game.player_black ={};
	new_game.player_white.socket = '';
	new_game.player_white.username = '';
	new_game.player_black.socket = '';
	new_game.player_black.username = '';

	var d = new Date();
	new_game.last_move_time = d.getTime();

	new_game.whose_turn = 'black';

	new_game.board =[
						/*0    1    2    3    4    5    6    7 */
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ' ], //0
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ' ], //1
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ' ], //2
						[' ', ' ', ' ', 'w', 'b', ' ', ' ', ' ' ], //3
						[' ', ' ', ' ', 'b', 'w', ' ', ' ', ' ' ], //4
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ' ], //5
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ' ], //6
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ' ] //7

				  	];
	new_game.legal_moves = calculate_valid_moves('b', new_game.board);

  	return new_game;
}

function check_line_match(who,dr,dc,r,c,board){
	if(board[r][c] === who){
		return true;

	}
	if(board[r][c] === ' '){
		return false;

	}

	if((r+dr <0) || (r+dr > 7 ) ){
		return false;
	}
	if((c+dc <0) || (c+dc > 7 ) ){
		return false;
	}
	return check_line_match(who,dr,dc,r+dr,c+dc,board);


}

function valid_move(who, dr,dc,r,c,board){
	var other;
	if(who === 'b'){
		other = 'w';
	}else if(who === 'w' ){
		other = 'b';
	}
	else{
		log('houston we have a color problem: '+ who);
		return false;
	}

	if((r+dr <0) || (r+dr > 7 ) ){
		return false;
	}
	if((c+dc <0) || (c+dc > 7 ) ){
		return false;
	}
	if(board[r+dr][c+dc]!=other){
		return false;
	}
	if((r+dr+dr <0) || (r+dr+dr > 7 ) ){
		return false;
	}
	if((c+dc+dc <0) || (c+dc+dc > 7 ) ){
		return false;
	}
	return check_line_match(who,dr,dc,r+dr+dr,c+dc+dc,board);


}


function calculate_valid_moves(who, board){
	var valid = [
						/*0    1    2    3    4    5    6    7 */
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ' ], //0
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ' ], //1
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ' ], //2
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ' ], //3
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ' ], //4
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ' ], //5
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ' ], //6
						[' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ' ]  //7

				  	];

  	var row, column;
	for(row = 0; row < 8 ; row++){
		for(column = 0; column <8; column++){
			if(board[row][column] === ' '){
				nw =  valid_move(who, -1, -1,row, column, board);
				nn =  valid_move(who, -1, 0,row, column, board);
				ne =  valid_move(who, -1, 1,row, column, board);

				ww =  valid_move(who, 0, -1,row, column, board);
				ee =  valid_move(who, 0, 1,row, column, board);

				sw =  valid_move(who, 1, -1,row, column, board);
				ss =  valid_move(who, 1, 0,row, column, board);
				se =  valid_move(who, 1, 1,row, column, board);

				if(nw || nn || ne || ww || ee || sw || ss || se){
					valid[row][column] = who;
				}

			}
		}
	}

	return valid;
}

function flip_line(who,dr,dc, r,c,board){
	if((r+dr <0) || (r+dr > 7 ) ){
		return false;
	}
	if((c+dc <0) || (c+dc > 7 ) ){
		return false;
	}
	if(board[r+dr][c+dc] === ' '){
		return false;
	}
	if(board[r+dr][c+dc] === who){
		return true;
	}
	else{
		if(flip_line(who,dr,dc,r+dr,c+dc,board)){
			board[r+dr][c+dc] = who;
			return true;
		}
		else{
			return false;
		}
	}

}


function flip_board(who,row,column,board){
	flip_line(who, -1, -1, row , column, board);
	flip_line(who, -1, 0,row, column, board);
	flip_line(who, -1, 1,row, column, board);

	flip_line(who, 0, -1,row, column, board);
	flip_line(who, 0, 1,row, column, board);

	flip_line(who, 1, -1,row, column, board);
	flip_line(who, 1, 0,row, column, board);
	flip_line(who, 1, 1,row, column, board);
}

function send_game_update(socket, game_id, message){

	/*check to see if a game with game id already exists*/
	if(('undefine' === typeof games[game_id]) || !games[game_id]){
		//no game exists
		console.log('no game exists. creating '+game_id+' for '+socket.id);
		games[game_id] = create_new_game();
	}

	/*make sure that only two people are in the game room */
	var roomObject;
	var numClients;
	do{
		roomObject = io.sockets.adapter.rooms[game_id];
		numClients = roomObject.length;
		if(numClients > 2){
			console.log('too many clients in room: ' +game_id+ ' #: ' +numClients);
			if(games[game_id].player_white.socket == roomObject.sockets[0]){
				games[game_id].player_white.socket = '';
				games[game_id].player_white.username = '';
					
			}
			if(games[game_id].player_black.socket == roomObject.sockets[0]){
				games[game_id].player_black.socket = '';
				games[game_id].player_black.username = '';
					
			}
			var sacrifice = Object.keys(roomObject.sockets)[0];
			io.of('/').connected[sacrifice].leave(game_id);
		}
	}while((numClients-1) > 2);

	/* Assign this socket a color*/
	if((games[game_id].player_white.socket!= socket.id) && (games[game_id].player_black.socket!= socket.id)){
		console.log('player isnt assigned a color: '+socket.id);

		if((games[game_id].player_black.socket!= '')&&(games[game_id].player_white.socket!='')){
			games[game_id].player_black.socket = '';
			games[game_id].player_white.socket = '';
			games[game_id].player_black.username = '';
			games[game_id].player_white.username = '';
		}
	}

	if(games[game_id].player_white.socket == ''){
		if(games[game_id].player_black.socket != socket.id){
			games[game_id].player_white.socket = socket.id;
			games[game_id].player_white.username = players[socket.id].username;
		}
	}

	if(games[game_id].player_black.socket == ''){
		if(games[game_id].player_white.socket != socket.id){
			games[game_id].player_black.socket = socket.id;
			games[game_id].player_black.username = players[socket.id].username;
		}
	}
	

	/* send game update */
	var success_data = {
						result: 'success',
						game: games[game_id],
						message: message,
						game_id: game_id
						};

	io.in(game_id).emit('game_update',success_data);

	/* check to see if the game is over */

	var row, column;
	var count = 0;
	var black = 0;
	var white = 0;
	for(row = 0; row < 8 ; row++){
		for(column = 0; column <8; column++){
			if(games[game_id].legal_moves[row][column] != ' '){count++;}
			if(games[game_id].board[row][column] === 'b'){black++;}
			if(games[game_id].board[row][column] === 'w'){white++;}
		}
	}
	if(count == 0){
		var winner = 'tie game';
		if(black > white){
			winner = 'black';
		}
		if(black < white){
			winner = 'white';
		}
		var success_data = {
			result:'success',
			game: games[game_id],
			who_won: winner,
			game_id: game_id
		};
		io.in(game_id).emit('game_over', success_data);
	

	//delete old games after an hour

		setTimeout(function(id){
			return function(){
				delete games[id];
			}
		}(game_id),60*60*1000);
	}else{
		//console.log("current count = "+count);
	}

};