window.onload = updateQRCode;

function createQrCodeUrl(uri) {
	return ("https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=" + encodeURIComponent(uri));
}

function updateQRCode() {
	// this interface has only one ipv4 adress
	console.log(location.host);
	$('#qrcodeRegion').append($('<img/>', {
		src: createQrCodeUrl(location.origin + location.pathname + 'tally')
	}));
	$('#qrcodeRegion').append($('<p>' + location.origin + location.pathname + 'tally' + '</p>'));
}