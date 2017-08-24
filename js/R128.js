class R128 {

	constructor(nodeToAnalyze){
		console.log(nodeToAnalyze);
		this.nodeToAnalyze = nodeToAnalyze;
		this.context = this.nodeToAnalyze.context;

		this.analyserPeak_L = AC.createAnalyser();
		this.analyserPeak_R = AC.createAnalyser();

		this.analyserRMS_L = AC.createAnalyser();
		this.analyserRMS_R = AC.createAnalyser();
		this.analyserEBU_S = AC.createAnalyser();

		this.peakBuffer3Seconds = Array(180);

		var ebu_splitter = AC.createChannelSplitter(2);
		var peakSplitter = AC.createChannelSplitter(2);

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

		this.analyserEBU_S = AC.createAnalyser();
		this.analyserEBU_S.fftSize = 2048;

		//CONNECTING EBU GRAPH
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

		ebu_channel_summing_gain.connect(this.analyserEBU_S);

		var rmsSplitter = AC.createChannelSplitter(2);

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

		// grab audio track for convolver node
		fetch("impulse responses/3sec-1-mono_44100.wav")
		.then(r => r.arrayBuffer())
		.then(b => AC.decodeAudioData(b))
		.then(audioBuffer => {
			rms_convolver_L.buffer = audioBuffer;
			rms_convolver_R.buffer = audioBuffer;
			ebu_convolver_L.buffer = audioBuffer;
			ebu_convolver_R.buffer = audioBuffer;
			console.log("Convolver buffer set!");
		});

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

		squareRootNodeRMS_L.connect(this.analyserRMS_L);
		squareRootNodeRMS_R.connect(this.analyserRMS_R);

		this.nodeToAnalyze.connect(ebu_splitter);
		this.nodeToAnalyze.connect(rmsSplitter);
		this.nodeToAnalyze.connect(peakSplitter);

		peakSplitter.connect(this.analyserPeak_L, 0, 0);
		peakSplitter.connect(this.analyserPeak_R, 1, 0);

		this.analyserPeak_L.fftSize = 32768;
		this.analyserPeak_L.smoothingTimeConstant = 0;

		this.analyserPeak_R.fftSize = 32768;
		this.analyserPeak_R.smoothingTimeConstant = 0;

		this.analyserRMS_L.fftSize = 2048;
		this.analyserRMS_R.fftSize = 2048;

		this.peakHistory3Seconds = new Array(180);
		this.lastCallToGetPeak = null;

	}


	getPeak(){
		var dataPeak_L = new Float32Array(this.analyserPeak_L.frequencyBinCount);
		var dataPeak_R = new Float32Array(this.analyserPeak_R.frequencyBinCount);
		this.analyserPeak_L.getFloatTimeDomainData(dataPeak_L);
		this.analyserPeak_R.getFloatTimeDomainData(dataPeak_R);
		var max_L = this.getMaxAbs(dataPeak_L);
		var max_R = this.getMaxAbs(dataPeak_R);
		var max = this.getMaxAbs([max_L, max_R]);
		this.peakHistory3Seconds.splice(0, 1);
		this.peakHistory3Seconds.push(max);
		var maxOf3Seconds = this.getMaxAbs(this.peakHistory3Seconds);

		this.lastCallToGetPeak = this.context.currentTime;

		return this.absoluteValueToDBFS(maxOf3Seconds);
	}


	getMaxAbs(array){
		var maxAbs = -Infinity;
		var len = array.length;
		for (var i=0 ; i < len; i++ )
		if (Math.abs(array[i]) > maxAbs ) maxAbs = Math.abs(array[i]);
		return maxAbs;
	}


	getRMS(){
		var dataArrayRMS_L = new Float32Array(this.analyserRMS_L.frequencyBinCount);
		var dataArrayRMS_R = new Float32Array(this.analyserRMS_R.frequencyBinCount);
		this.analyserRMS_L.getFloatTimeDomainData(dataArrayRMS_L);
		this.analyserRMS_R.getFloatTimeDomainData(dataArrayRMS_R);
		return [
			this.absoluteValueToDBFS(dataArrayRMS_L[0] * Math.SQRT2),
			this.absoluteValueToDBFS(dataArrayRMS_R[1] * Math.SQRT2)
		];
	}


	getShortTermLoudness(){
		var dataArrayEBU_S = new Float32Array(this.analyserEBU_S.frequencyBinCount);
		this.analyserEBU_S.getFloatTimeDomainData(dataArrayEBU_S);
		var ebu_lkfs = -0.691 + (10 * Math.log10(dataArrayEBU_S[0]));
		return ebu_lkfs;
	}


	getPSR(){
		return this.getPeak() - this.getShortTermLoudness();
	}






	absoluteValueToDBFS(value){
		return 20 * Math.log10(value);
	}

}
