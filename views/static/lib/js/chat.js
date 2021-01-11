let producer = {};
producer.avatar = 'lib/img/comment_producer.png';
producer.type = 'producer';
producer.from = 'Producer';

let server = {};
server.avatar = 'lib/img/comment_server.png';
server.type = 'server';
server.from = 'Server';

let client = {};
client.avatar = 'lib/img/comment_client.png';
client.type = 'client';
client.from = 'Client';

function formatAMPM(date) {
	let hours = date.getHours();
	let minutes = date.getMinutes();
	let ampm = hours >= 12 ? 'PM' : 'AM';
	hours = hours % 12;
	hours = hours ? hours : 12; // the hour '0' should be '12'
	minutes = minutes < 10 ? '0'+minutes : minutes;
	let strTime = hours + ':' + minutes + ' ' + ampm;
	return strTime;
}

function insertChat(who, socketid, text) {
	let chatbox = 'left';
	let avatar = 'lib/img/comment_client.png';
	let from = '';
	let date = formatAMPM(new Date());
	let control = '';

	if (who === chat_me.type) {
		avatar = chat_me.avatar;
		from = chat_me.from;
		if (socketid === socket.id) {
			chatbox = 'right';
		}
	}
	else if (who === 'server') {
		avatar = server.avatar;
		from = server.from;
	}
	else if (who === 'producer') {
		avatar = producer.avatar;
		from = producer.from;
	}
	else {
		avatar = client.avatar;
		if ((chat_me.type === 'producer') || (chat_me.type === 'server')) {
			for (let i = 0; i < listener_clients.length; i++) {
				if (listener_clients[i].socketId === socketid) {
					from = 'Client: ' + listener_clients[i].ipAddress.replace('::ffff:', '') + 
					' (' + listener_clients[i].listenerType + ') ' + 
					'<i>' + getDeviceById(listener_clients[i].deviceId).name + '</i>';
					break;
				}
			}
		}
	}

	if (chatbox === 'left') {
		control = '<li style="width:100%">' +
			'<div class="msj macro">' +
			'<div class="avatar"><img class="img-avatar" src="' + avatar + '" /></div>' +
				'<div class="text text-l">' +
					'<p><b>' + from + '</b></p>' + 
					'<p>' + text + '</p>' +
					'<p><small>' + date + '</small></p>' +
				'</div>' +
			'</div>' +
		'</li>';
	}
	else {
		control = '<li style="width:100%;">' +
			'<div class="msj-rta macro">' +
				'<div class="text text-r">' +
					'<p><b>' + from + '</b></p>' + 
					'<p>' + text + '</p>' +
					'<p><small>' + date + '</small></p>' +
				'</div>' +
			'<div class="avatar" style="padding:0px 0px 0px 10px !important"><img class="img-avatar" src="' + avatar + '" /></div>' + 
		'</li>';
	}
	$('#message-ul').append(control).scrollTop($('#message-ul').prop('scrollHeight'));
}

function resetChat(){
	$('#message-ul').empty();
}

var chatTags = [];
/*
$('input#chat-text').autocomplete({
	source: chatTags,
	minLength: 0
});
	
$('input#chat-text').autocomplete("disable");
	
$('input#chat-text').keyup(function() {
	let value = $('input#chat-text').val();
	let last = value.substr(value.length - 1);
	if (last == "@") {
		let valToSearch = value.substr(0, value.length - 1);
		$('input#chat-text').autocomplete("enable");
		$('input#chat-text').autocomplete("search", valToSearch);
	}
	else {
		$('input#chat-text').autocomplete("disable");
	}
});*/

$('input#chat-text').on('keydown', function(e){
	if (e.which == 13){
		var text = $(this).val();
		if (text !== ''){
			sendMessage(text);
			$(this).val('');
		}
	}
});

$('#sendchat').click(function(){
	$('input#chat-text').trigger({type: 'keydown', which: 13, keyCode: 13});
});

function sendMessage(text) {
	socket.emit('messaging', chat_me.type, text);
}