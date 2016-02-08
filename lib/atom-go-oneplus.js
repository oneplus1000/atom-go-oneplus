var proc = require('child_process');
var MessagePanelView = require('atom-message-panel').MessagePanelView,
	PlainMessageView = require('atom-message-panel').PlainMessageView,
	LineMessageView = require('atom-message-panel').LineMessageView;

var messages = new MessagePanelView({
	title: 'go oracle result'
});

var messagesBreakpoint = new MessagePanelView({
	title: 'breakpoint cmd'
});

module.exports = {
	activate: function() {

		atom.commands.add('atom-workspace', 'atom-go-oneplus:run-definition', this.run_definition);
		atom.commands.add('atom-workspace', 'atom-go-oneplus:run-describe', this.run_describe);
		atom.commands.add('atom-workspace', 'atom-go-oneplus:run-referrers', this.run_referrers);
		atom.commands.add('atom-workspace', 'atom-go-oneplus:run-install', this.run_install);
		atom.commands.add('atom-workspace', 'atom-go-oneplus:current-line', this.get_current_line);

	},
	run_definition: function() {
		runGooracle('definition');
	},
	run_describe: function() {
		runGooracle('describe');
	},
	run_referrers: function() {
		runGooracle('referrers');
	},
	run_install: function() {
		runInstall();
	},
	get_current_line: function() {
		getCurrentLine();
	}
};

var getCurrentLine = function() {

	var textEditor = atom.workspace.getActiveTextEditor();
	var grammar = textEditor.getGrammar();
	if (!grammar || grammar.name != 'Go') {
		return;
	}

	var gopath = process.env.GOPATH;
	var gosrcpath = gopath + '/src/';
	var filepath = textEditor.getPath();
	var filepath = filepath.substring(gosrcpath.length);
	var currentline = textEditor.getCursorBufferPosition().row + 1;
	var breakCmd = "b " + filepath + ":" + currentline;
	var p = messagesBreakpoint.panel;
	if (typeof(p) === 'undefined' || p.visible == false) {
		//ถ้ามันเคยถูกซ่อนมาให้ clear ค่าเดิมเพราะถือว่าเค้าไม่สนใจค่านั้นๆ แล้ว
		messagesBreakpoint.clear();
	}
	messagesBreakpoint.attach();
	messagesBreakpoint.add(new PlainMessageView({
		message: breakCmd,
		className: 'text-default'
	}));
};

var runInstall = function() {

	var textEditor = atom.workspace.getActiveTextEditor();
	var grammar = textEditor.getGrammar();
	if (!grammar || grammar.name != 'Go') {
		return;
	}
	var gopath = process.env.GOPATH;
	var gosrcpath = gopath + '/src/';
	var filepath = textEditor.getPath();

	var pkgpath = filepath.substring(gosrcpath.length);
	pkgpath = pkgpath.substring(0, pkgpath.lastIndexOf("/"))

	var args = ['go', 'install', pkgpath];
	proc.exec(args.join(' '), {
		cwd: gopath
	}, function(error, stdout, stderr) {
		//done
		if (error != null) {
			atom.notifications.addError(stderr);
		}
	});
};

var runGooracle = function(mode) {
	var me = this;
	var textEditor = atom.workspace.getActiveTextEditor();
	var grammar = textEditor.getGrammar();
	if (!grammar || grammar.name != 'Go') {
		return;
	}
	var gopath = process.env.GOPATH;
	var gosrcpath = gopath + '/src/';
	var filepath = textEditor.getPath();
	var wordEnd = textEditor.getSelectedBufferRange().end;
	var offset = new Buffer(textEditor.getTextInBufferRange([
		[0, 0], wordEnd
	])).length;

	//init
	if (mode == 'referrers' || mode == 'definition') {
		messages.attach();
		messages.clear();
		messages.add(new PlainMessageView({
			message: 'loading...',
			className: 'text-default'
		}));
	}
	//run
	gooracle(gopath, filepath, offset, mode, function(mode, json) {
		if (mode == 'definition') {
			definition(json);
		} else if (mode == 'describe') {
			describe(json);
		} else if (mode == 'referrers') {
			referrers(json);
		}
	});

};

var gooracle = function(gopath, filepath, offset, mode, callback) {
	var args = ['oracle', '-pos=' + filepath + ':#' + offset, '-format=json ', mode];
	var cmd = args.join(' ');
	proc.exec(cmd, {
		cwd: gopath
	}, function(error, stdout, stderr) {
		//done
		if (error == null) {
			//debugger;
			var json = JSON.parse(stdout);
			callback(mode, json);
		} else {
			//ERROR
		}
	});
};

var definition = function(json) {
	messages.clear();
	var d = json.definition;
	var tokens = d.objpos.split(':');
	messages.add(new LineMessageView({
		message: d.desc,
		file: tokens[0],
		line: tokens[1],
		character: tokens[2],
		className: 'text-info'
	}));
}

var describe = function(json) {

	var d = json.describe;
	var v = d.value;
	var html = '';
	html += formatInfo('desc', d.desc);
	html += '<br />';
	html += formatInfo('detail', d.detail);
	if (typeof(v) !== 'undefined' && v != null) {
		if (typeof(v.objpos) !== 'undefined') {
			html += '<br />';
			html += formatInfo('objpos', v.objpos);
		}
		html += '<br />';
		html += formatInfo('type', v.type);
	}
	atom.notifications.addInfo(html);
};

var referrers = function(json) {

	messages.clear();

	if (typeof(json.referrers) === 'undefined' || json.referrers == null) {
		return;
	}

	if (typeof(json.referrers.refs) === 'undefined' || json.referrers.refs == null) {
		return;
	}

	var refs = json.referrers.refs;
	var i = 0,
		max = refs.length;
	while (i < max) {
		var tokens = refs[i].split(':');
		messages.add(new LineMessageView({
			message: "",
			file: tokens[0],
			line: tokens[1],
			character: tokens[2],
			className: 'text-info'
		}));
		i++;
	}


};

var formatInfo = function(title, desc) {
	return '<b>' + title + '</b><br />' + desc + '';
}
