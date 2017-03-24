var AC = new AudioContext();
var audio_source_element = document.getElementById("audio_source");
var source = AC.createMediaElementSource(audio_source_element);
var analyserPeak = AC.createAnalyser();
var analyserRMS_L = AC.createAnalyser();
var analyserRMS_R = AC.createAnalyser();
var canvas_waveform = document.getElementById("canvas_waveform");
var canvas_loudness = document.getElementById("canvas_loudness");
var rms_display = document.getElementById("rms_display");
var psr_display = document.getElementById("psr_display");
var short_term_loudness_display = document.getElementById("short_term_loudness_display");
var canvas_waveform_width = canvas_waveform.width;
var canvas_waveform_height = canvas_waveform.height;
var canvas_vertical_middle = canvas_waveform_height / 2;
var canvasCtx_waveform = canvas_waveform.getContext("2d");
var canvasCtx_loudness = canvas_loudness.getContext("2d");
var peakArray = new Array(canvas_waveform_width);
var rmsArray_L = new Array(canvas_waveform_width);
var rmsArray_R = new Array(canvas_waveform_width);
var psrArray = new Array(canvas_waveform_width);

var ebu_splitter = AC.createChannelSplitter(2);

//first stage shelving filter
var highshelf_filter_L = AC.createBiquadFilter();
highshelf_filter_L.type = "highshelf";
highshelf_filter_L.Q.value = 1;
highshelf_filter_L.frequency.value = 1500;
highshelf_filter_L.gain.value = 4;

var highshelf_filter_R = AC.createBiquadFilter();
highshelf_filter_R.type = "highshelf";
highshelf_filter_R.Q.value = 1;
highshelf_filter_R.frequency.value = 1500;  //deduced with IIRFilter.getFrequencyResponse
highshelf_filter_R.gain.value = 4;

// second stage highpass filter
var highpass_filter_L = AC.createBiquadFilter();
highpass_filter_L.frequency.value = 76;
highpass_filter_L.Q.value = 1;
highpass_filter_L.type = "highpass";

var highpass_filter_R = AC.createBiquadFilter();
highpass_filter_R.frequency.value = 76;
highpass_filter_R.Q.value = 1;
highpass_filter_R.type = "highpass";

//SQUARING EVERY CHANNEL
var ebu_square_gain_L = AC.createGain();
ebu_square_gain_L.gain.value = 0;

var ebu_square_gain_R = AC.createGain();
ebu_square_gain_R.gain.value = 0;

var ebu_convolver_L = AC.createConvolver();
ebu_convolver_L.normalize = false;
var ebu_convolver_R = AC.createConvolver();
ebu_convolver_R.normalize = false;

var ebu_mean_gain_L = AC.createGain();
ebu_mean_gain_L.gain.value = 1/(AC.sampleRate * 3);
var ebu_mean_gain_R = AC.createGain();
ebu_mean_gain_R.gain.value = 1/(AC.sampleRate * 3);

var ebu_channel_summing_gain = AC.createGain();

var ebu_s_analyzer = AC.createAnalyser();
ebu_s_analyzer.fftSize = 2048;

//CONNECTING EBU GRAPH
source.connect(ebu_splitter);
ebu_splitter.connect(highshelf_filter_L, 0, 0);
ebu_splitter.connect(highshelf_filter_R, 1, 0);

highshelf_filter_L.connect(highpass_filter_L);
highshelf_filter_R.connect(highpass_filter_R);

highpass_filter_L.connect(ebu_square_gain_L);
highpass_filter_L.connect(ebu_square_gain_L.gain);

highpass_filter_R.connect(ebu_square_gain_R);
highpass_filter_R.connect(ebu_square_gain_R.gain);

ebu_square_gain_L.connect(ebu_convolver_L).connect(ebu_mean_gain_L);
ebu_square_gain_R.connect(ebu_convolver_R).connect(ebu_mean_gain_R);

//Sum the signal
ebu_mean_gain_L.connect(ebu_channel_summing_gain);
ebu_mean_gain_R.connect(ebu_channel_summing_gain);

ebu_channel_summing_gain.connect(ebu_s_analyzer);

for(var i=0; i<canvas_waveform_width; i++){
	peakArray[i] = 0;
	rmsArray_L[i] = 0;
	rmsArray_R[i] = 0;
	psrArray[i] = 0;
}


function absoluteValueToDBFS(value){
	return 20 * Math.log10(value);
}

var rmsSplitter = AC.createChannelSplitter(2);
source.connect(rmsSplitter);

//SQUARING THE SIGNAL
var squareGainRMS_L = AC.createGain();
squareGainRMS_L.gain.value = 0;
var squareGainRMS_R = AC.createGain();
squareGainRMS_R.gain.value = 0;

var gainAfterRMSSplitter_L = AC.createGain();
gainAfterRMSSplitter_L.gain.value = 1;
var gainAfterRMSSplitter_R = AC.createGain();
gainAfterRMSSplitter_R.gain.value = 1;

rmsSplitter.connect(gainAfterRMSSplitter_L, 0, 0);
rmsSplitter.connect(gainAfterRMSSplitter_R, 1, 0);

gainAfterRMSSplitter_L.connect(squareGainRMS_L);
gainAfterRMSSplitter_L.connect(squareGainRMS_L.gain);
gainAfterRMSSplitter_R.connect(squareGainRMS_R);
gainAfterRMSSplitter_R.connect(squareGainRMS_R.gain);

var rms_convolver_L = AC.createConvolver();
rms_convolver_L.normalize = false;
var rms_convolver_R = AC.createConvolver();
rms_convolver_R.normalize = false;
// grab audio track via XHR for convolver node
var ajaxRequest = new XMLHttpRequest();
ajaxRequest.open('GET', "impulse responses/3sec-1-mono_44100.wav", true);
ajaxRequest.responseType = 'arraybuffer';

ajaxRequest.onload = function() {
	var audioData = ajaxRequest.response;
	AC.decodeAudioData(audioData, function(audioBuffer) {
		rms_convolver_L.buffer = audioBuffer;
		rms_convolver_R.buffer = audioBuffer;
		ebu_convolver_L.buffer = audioBuffer;
		ebu_convolver_R.buffer = audioBuffer;
		console.log("Convolver buffer set!");
	}, function(e){"Error with decoding audio data" + e.err});
}

ajaxRequest.send();

squareGainRMS_L.connect(rms_convolver_L);
squareGainRMS_R.connect(rms_convolver_R);

var squareRootNodeRMS_L = AC.createWaveShaper();
var squareRootNodeRMS_R = AC.createWaveShaper();

function makeSquareRootCurve(amount) {
	var curve = new Float32Array(amount);
	var slope = 1 / ((amount - 1)/2);

	for (var i = 0; i < amount; i++ ) {
		if (i > (amount/2)){
			var sample_value = slope * i - 1;
			var target_value = Math.sqrt(sample_value);
			curve[i] = target_value;
		}
		else {
			curve[i] = 0;
		}
	}
	return curve;
};

squareRootNodeRMS_L.curve = makeSquareRootCurve(40000000);
squareRootNodeRMS_R.curve = makeSquareRootCurve(40000000);
squareRootNodeRMS_L.oversample = "4x";
squareRootNodeRMS_R.oversample = "4x";

var gainAfterConvolverRMS_L = AC.createGain();
gainAfterConvolverRMS_L.gain.value = (1/(AC.sampleRate*3));
var gainAfterConvolverRMS_R = AC.createGain();
gainAfterConvolverRMS_R.gain.value = (1/(AC.sampleRate*3));

rms_convolver_L.connect(gainAfterConvolverRMS_L);
rms_convolver_R.connect(gainAfterConvolverRMS_R);

gainAfterConvolverRMS_L.connect(squareRootNodeRMS_L);
gainAfterConvolverRMS_R.connect(squareRootNodeRMS_R);

squareRootNodeRMS_L.connect(analyserRMS_L);
squareRootNodeRMS_R.connect(analyserRMS_R);

source.connect(analyserPeak);
source.connect(AC.destination);

analyserPeak.fftSize = 2048;
analyserRMS_L.fftSize = 2048;
analyserRMS_R.fftSize = 2048;
var bufferLength = analyserPeak.frequencyBinCount;
var dataArrayPeak = new Float32Array(bufferLength);
var dataArrayRMS_L = new Float32Array(bufferLength);
var dataArrayRMS_R = new Float32Array(bufferLength);
var dataArrayEBU_S = new Float32Array(bufferLength);

Float32Array.prototype.max = function(){
	var max = -Infinity;
	var len = this.length;
	for (var i=0 ; i < len; i++ )
	if ( this[i] > max ) max = this[i];
	return max;
};

Array.prototype.max = function(){
	var max = -Infinity;
	var len = this.length;
	for (var i=0 ; i < len; i++ )
	if ( this[i] > max ) max = this[i];
	return max;
};

var peakBuffer3Seconds = Array(180);

function draw() {
	analyserPeak.getFloatTimeDomainData(dataArrayPeak);
	analyserRMS_L.getFloatTimeDomainData(dataArrayRMS_L);
	analyserRMS_R.getFloatTimeDomainData(dataArrayRMS_R);
	ebu_s_analyzer.getFloatTimeDomainData(dataArrayEBU_S);

	var ebu_lkfs = -0.691 + (10 * Math.log10(dataArrayEBU_S[0]));
	short_term_loudness_display.innerHTML = (Math.round( ebu_lkfs * 10 ) / 10).toFixed(1) + " LUFS";

	//PEAK Calculation
	peakArray.splice(0, 1);
	var max = dataArrayPeak.max();
	peakArray.push(max);

	//PEAK buffer
	peakBuffer3Seconds.splice(0, 1);
	peakBuffer3Seconds.push(max);
	var max_of_3_seconds = peakBuffer3Seconds.max();

	rmsArray_L.splice(0, 1);
	rmsArray_R.splice(0, 1);
	var newValue_L = dataArrayRMS_L[0];
	var newValue_R = dataArrayRMS_R[0];
	//console.log(dataArrayRMS_L[0])
	rmsArray_L.push(newValue_L);
	rmsArray_R.push(newValue_R);
	var rms_L_db = absoluteValueToDBFS(newValue_L * Math.SQRT2);
	var rms_R_db = absoluteValueToDBFS(newValue_R * Math.SQRT2);
	rms_display.innerHTML = "L " + (Math.round( rms_L_db * 10 ) / 10).toFixed(1) + " dbFS<br>R " + (Math.round( rms_R_db * 10 ) / 10).toFixed(1) + " dbFS";

	//Compute Peak to short-term loudness ratio PSR
	var psr_lu = absoluteValueToDBFS(max_of_3_seconds) - ebu_lkfs;
	if (!isNaN(psr_lu)){
		psr_display.innerHTML = (Math.round( psr_lu * 10 ) / 10).toFixed(1) + " LU";
	}
	else {
		psr_display.innerHTML = "No signal";
	}

	psrArray.splice(0, 1);
	psrArray.push(psr_lu);

	canvasCtx_waveform.fillStyle = 'rgb(255, 255, 255)';
	canvasCtx_waveform.fillRect(0, 0, canvas_waveform_width, canvas_waveform_width);
	canvasCtx_waveform.lineWidth = 1;

	//PEAK
	canvasCtx_waveform.strokeStyle = 'rgb(0, 0, 255)';
	canvasCtx_waveform.beginPath();

	for (var x = 0; x < peakArray.length; x++) {

		var y_down = canvas_vertical_middle - (peakArray[x] * canvas_waveform_height);
		var y_up = canvas_vertical_middle + (peakArray[x] * canvas_waveform_height);

		canvasCtx_waveform.moveTo(x, y_down);
		canvasCtx_waveform.lineTo(x, y_up);
	}

	canvasCtx_waveform.stroke();

	//RMS
	canvasCtx_waveform.strokeStyle = 'rgb(255, 0, 0)';
	canvasCtx_waveform.lineWidth = 2;
	canvasCtx_waveform.beginPath();
	canvasCtx_waveform.moveTo(0, canvas_waveform_height);
	for (var x = 0; x < rmsArray_L.length; x++) {
		var y = canvas_waveform_height - (rmsArray_L[x] * 1.7 * canvas_waveform_height);
		canvasCtx_waveform.lineTo(x, y);
	}

	canvasCtx_waveform.stroke();


	//PSR

	canvasCtx_loudness.fillStyle = 'rgb(255, 255, 255)';
	canvasCtx_loudness.fillRect(0, 0, canvas_waveform_width, canvas_waveform_width);
	canvasCtx_loudness.lineWidth = 1;


	for (var x = 0; x < psrArray.length; x++) {

		canvasCtx_loudness.beginPath();

		if (psrArray[x] < 4.75){
			canvasCtx_loudness.strokeStyle = '#000000';  //black
		}

		else if (psrArray[x] < 5.75){
			canvasCtx_loudness.strokeStyle = '#770000';  //dark red
		}

		else if (psrArray[x] < 6.75){
			canvasCtx_loudness.strokeStyle = '#ff0000';  //red
		}

		else if (psrArray[x] < 7.25){
			canvasCtx_loudness.strokeStyle = '#ff4500';  //orangered
		}

		else if (psrArray[x] < 7.75){
			canvasCtx_loudness.strokeStyle = '#ffa500';  //orange
		}

		else if (psrArray[x] < 8.5){
			canvasCtx_loudness.strokeStyle = '#ffc500';  //brighter orange
		}

		else if (psrArray[x] < 9.75){
			canvasCtx_loudness.strokeStyle = '#ffff00';  //yellow
		}

		else if (psrArray[x] < 11){
			canvasCtx_loudness.strokeStyle = '#b4ff00';  //yellow green
		}

		else {
			canvasCtx_loudness.strokeStyle = '#00ff00';  //lime green
		}

		var y = canvas_waveform_height - ((psrArray[x] / 17) * canvas_waveform_height);
		//console.log(lineHeight);
		canvasCtx_loudness.moveTo(x, canvas_waveform_height);
		canvasCtx_loudness.lineTo(x, y);
		canvasCtx_loudness.stroke();
	}

	requestAnimationFrame(draw);
};
draw();


var file_input = document.getElementById("file_input");
file_input.addEventListener("change", function(e){

	var file = e.target.files[0];
	var fileURL = URL.createObjectURL(file);
	audio_source_element.src = fileURL;

})

document.getElementById("button_live_input").addEventListener("click", function(){

	if (navigator.mediaDevices) {
	    console.log('getUserMedia supported.');
	    navigator.mediaDevices.getUserMedia ({audio: true})
	    .then(function(stream) {
	        var liveSource = AC.createMediaStreamSource(stream);
	        liveSource.connect(rmsSplitter);
			liveSource.connect(ebu_splitter);
			liveSource.connect(analyserPeak);
	    })
	    .catch(function(err) {
	        console.log('The following gUM error occured: ' + err);
	    });
	} else {
	   console.log('getUserMedia not supported on your browser!');
	}

});
