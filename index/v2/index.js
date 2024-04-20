export default class MediaControls extends HTMLElement {
	/* props */
	get youtubeId() {
		return this.getAttribute("youtube-id");
	}
	get demoId() {
		return this.getAttribute("demo-id");
	}
	get artist() {
		return this.getAttribute("artist") || "Chamin";
	}
	get timeoutNext() {
		return Number(this.getAttribute("timeout-next")) || 2000;
	}

	/* state */
	debug = false;
	domId = null;
	player = null;

	/* computed */
	get isFirstTrack() {
		return this.trackIndex === 1;
	}
	get isLastTrack() {
		return sdk.tracks.length === this.trackIndex;
	}
	get $body() {
		return document.querySelector("body");
	}
	get $aScene() {
		return document.querySelector("a-scene");
	}

	onAframeLoaded(data) {
		this.setAttribute("aframe-ready", true);
		this.$body.setAttribute("aframe-ready", true);
	}
	onYouTubeIframeAPIReady(event) {
		console.log(this.track);
		this.player = new window.YT.Player(this.domId, {
			height: "390",
			width: "640",
			videoId: this.track.yt_id,
			playerVars: {
				playsinline: 1,
			},
			events: {
				onReady: this.onPlayerReady.bind(this),
				onStateChange: this.onPlayerStateChange.bind(this),
			},
		});
		this.setAttribute("youtube-iframe-ready", true);
	}
	onPlayerReady(event) {
		this.videoTitle = event.target.videoTitle;
		if (this.player.isMuted()) {
			this.setAttribute("muted", true);
		}

		/* only works in firefox for now */
		if (typeof navigator.getAutoplayPolicy === "function") {
			if (navigator.getAutoplayPolicy("mediaelement") === "allowed-muted") {
				this.onAutoPlayNotAllowed();
			} else if (navigator.getAutoplayPolicy("mediaelement") === "disallowed") {
				this.onAutoPlayNotAllowed();
			} else if (navigator.getAutoplayPolicy("mediaelement") === "allowed") {
				console.info("Auto play of audio is correctly setup.");
			}
		}

		/* needed for the UI to catch markup change? */
		setTimeout(() => {
			this.setAttribute("youtube-ready", true);
			this.$body.setAttribute("youtube-ready", true);
			try {
				this.player.playVideo();
			} catch (e) {
				this.onAutoPlayNotAllowed();
			}
		}, 1000);
		this.renderUI();
	}
	onPlayerStateChange({ target, data }) {
		if (data === 0) {
			this.onTrackStop();
		}
		this.setAttribute("player-state", data);
	}
	onTrackStop() {
		setTimeout(() => {
			if (this.trackIndex === sdk.tracks.length) {
				this.visitHome();
			} else {
				this.visitTrack(this.nextTrack);
			}
		}, this.timeoutNext);
	}
	onAutoPlayNotAllowed() {
		this.setAttribute("autoplay-not-allowed", true);
	}
	async onTrackSelect(event) {
		const track = await sdk.getTrackForDemo(event.target.value);
		console.log(event, track);
		this.visitTrack(track);
	}
	onButtonPrevious() {
		if (this.isFirstTrack) {
			this.visitHome();
		} else {
			this.visitTrack(this.previousTrack);
		}
	}
	onButtonNext() {
		if (this.isLastTrack) {
			this.visitHome();
		} else {
			this.onTrackStop();
		}
	}
	onButtonHome() {
		this.visitHome();
	}
	onButtonFullscreen() {
		if (window.fullscreen) {
			document.exitFullscreen();
		} else {
			document.querySelector("body").requestFullscreen();
		}
	}
	onButtonMute() {
		if (this.player.isMuted()) {
			this.setAttribute("muted", false);
			this.player.unMute();
		} else {
			this.setAttribute("muted", true);
			this.player.mute();
		}
	}
	onButtonPlay() {
		this.player.unMute();
		this.player.playVideo();
	}
	stopVideo() {
		this.player.stopVideo();
	}
	visitTrack(track) {
		const nextUrl = new URL(
			`../../../tracks/${track.demo_id}/`,
			import.meta.url,
		);
		window.location = nextUrl.href;
	}
	visitHome() {
		const nextUrl = new URL(`../../../`, import.meta.url);
		if (this.track) {
			nextUrl.searchParams.set("track", this.track.demo_id);
		}
		window.location = nextUrl.href;
	}
	newRandomId() {
		return btoa(Date.now());
	}
	async connectedCallback() {
		this.domId = this.newRandomId();
		await sdk.init();
		if (this.youtubeId) {
			this.track = sdk.getTrackForYtid(this.youtubeId);
		} else if (this.demoId) {
			this.track = sdk.getTrackForDemo(this.demoId);
		}
		if (this.track) {
			this.nextTrack = sdk.getNextTrack(this.track);
			this.previousTrack = sdk.getPreviousTrack(this.track);
			this.trackIndex = sdk.getTrackIndex(this.track);
			this.initYoutubeIframe();
		}
		if (this.$aScene) {
			this.initAScene();
		}
		this.render();
		if (this.debug) {
			console.table(sdk.tracks);
			console.info(
				this.trackIndex,
				this.track,
				this.nextTrack,
				this.previousTrack,
			);
		}
	}
	initYoutubeIframe() {
		const scriptExists = this.createScriptTag();
		if (scriptExists) {
			this.onYouTubeIframeAPIReady();
		} else {
			window.onYouTubeIframeAPIReady = this.onYouTubeIframeAPIReady.bind(this);
		}
	}
	initAScene() {
		if (window.AFRAME) {
			this.onAframeLoaded();
		} else {
			console.error("A frame not loaded");
		}
	}
	createScriptTag() {
		const $exisiting = document.getElementsByTagName(
			'script[name="youtube-iframe"]',
		)[0];
		if ($exisiting) {
			return;
		}
		const tag = document.createElement("script");
		tag.setAttribute("name", "youtube-iframe");
		tag.src = "https://www.youtube.com/iframe_api";
		const firstScriptTag = document.getElementsByTagName("script")[0];
		firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
	}

	render() {
		this.innerHTML = "";
		const $ytContainer = this.createYtContainer();
		this.append($ytContainer);
	}
	renderUI() {
		const $uis = this.createUiDoms();
		this.append(...$uis);
	}
	createYtContainer() {
		const $ytContainer = document.createElement("div");
		$ytContainer.setAttribute("id", this.domId);
		return $ytContainer;
	}
	createUiDoms() {
		const artistAndTitle = `${this.artist} - ${this.track.title}`;
		const $track = document.createElement("media-track");

		/* a track select and current index */
		const $trackCount = document.createElement("media-track-count");
		$trackCount.setAttribute(
			"title",
			`Playing track n⁰${this.trackIndex} on ${sdk.tracks.length} in the album (select track)`,
		);
		const $trackSelect = document.createElement("select");
		$trackSelect.addEventListener("input", this.onTrackSelect.bind(this));
		const $trackSelectDefaultOption = document.createElement("option");
		$trackSelectDefaultOption.setAttribute("disabled", true);
		$trackSelectDefaultOption.innerText = `${this.trackIndex}/${sdk.tracks.length}`;
		$trackSelectDefaultOption.selected = true;
		const $trackOptions = sdk.tracks.map((track, index) => {
			const $trackSelectOption = document.createElement("option");
			$trackSelectOption.innerText = `${track.title} / ${track.title_i18n} (${
				index + 1
			}/${sdk.tracks.length})`;
			$trackSelectOption.value = track.demo_id;
			return $trackSelectOption;
		});
		$trackSelect.append($trackSelectDefaultOption, ...$trackOptions);
		$trackCount.append($trackSelect);

		const $trackTitle = document.createElement("media-track-title");
		const $trackTitleLink = document.createElement("a");
		$trackTitleLink.innerText = artistAndTitle;
		$trackTitleLink.title = `(Youtube) ${artistAndTitle}`;
		$trackTitleLink.setAttribute(
			"href",
			`https://youtu.be/${this.track.yt_id}`,
		);
		$trackTitle.append($trackTitleLink);

		const $buttons = document.createElement("media-track-buttons");
		const $next = document.createElement("button");
		$next.innerText = "→";
		$next.title = "Next track";
		$next.setAttribute("name", "next");
		$next.addEventListener("click", this.onButtonNext.bind(this));

		const $previous = document.createElement("button");
		$previous.innerText = "←";
		$previous.title = "Previous track";
		$previous.setAttribute("name", "previous");
		$previous.addEventListener("click", this.onButtonPrevious.bind(this));

		const $home = document.createElement("button");
		$home.innerText = "↑";
		$home.title = "Go home";
		$home.setAttribute("name", "home");
		$home.addEventListener("click", this.onButtonHome.bind(this));

		const $fullscreen = document.createElement("button");
		$fullscreen.innerText = "⇱";
		$fullscreen.title = "Fullscreen";
		$fullscreen.setAttribute("name", "fullscreen");
		$fullscreen.addEventListener("click", this.onButtonFullscreen.bind(this));

		const $mute = document.createElement("button");
		$mute.innerText = "♪";
		$mute.title = "Audio (mute/un-mute)";
		$mute.setAttribute("name", "mute");
		$mute.addEventListener("click", this.onButtonMute.bind(this));

		const $play = document.createElement("button");
		$play.innerText = "►";
		$play.title = "Play";
		$play.setAttribute("name", "play");
		$play.addEventListener("click", this.onButtonPlay.bind(this));

		$buttons.append($mute, $fullscreen, $previous, $next, $trackCount, $home);
		$track.append($trackTitle, $play, $buttons);
		return [$track];
	}
}
