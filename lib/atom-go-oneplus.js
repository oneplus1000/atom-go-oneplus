var proc = require('child_process');
var fs = require('fs');

var MessagePanelView = require('atom-message-panel').MessagePanelView,
	PlainMessageView = require('atom-message-panel').PlainMessageView,
	LineMessageView = require('atom-message-panel').LineMessageView;

var messages = new MessagePanelView({
	title: 'go oracle result'
});

var messagesBreakpoint = new MessagePanelView({
	title: 'Oneplus: get breakpoint cmd'
});

var errcheckmessages = new MessagePanelView({
	title: 'Oneplus: errcheck'
});

var refmessages = new MessagePanelView({
	title: 'Oneplus: go-oracle referrers'
});

/*
go get -u golang.org/x/tools/cmd/oracle
go get -u github.com/kisielk/errcheck
*/

module.exports = {
	activate: function() {

		atom.commands.add('atom-workspace', 'atom-go-oneplus:run-definition', this.run_definition);
		atom.commands.add('atom-workspace', 'atom-go-oneplus:run-describe', this.run_describe);
		atom.commands.add('atom-workspace', 'atom-go-oneplus:run-referrers', this.run_referrers);
		atom.commands.add('atom-workspace', 'atom-go-oneplus:run-install', this.run_install);
		atom.commands.add('atom-workspace', 'atom-go-oneplus:current-line', this.get_current_line);
		//atom-go-oneplus:run-errcheck
		atom.commands.add('atom-workspace', 'atom-go-oneplus:run-errcheck', this.run_errcheck);

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
	},
	run_errcheck: function() {
		runErrcheck();
	}
};

var runErrcheck = function() {

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
	var args = ['errcheck', pkgpath];

	errcheckmessages.attach();
	errcheckmessages.clear();
	proc.exec(args.join(' '), {
		cwd: gopath
	}, function(error, stdout, stderr) {

		if (error != null) {

			var errChkMsgs = [];
			var lines = (stdout + '').split('\n');
			var i = 0,
				max = lines.length;
			while (i < max) {
				var line = lines[i];
				if (line == null || line == "") {
					break;
				}
				var indexSpace = line.indexOf('\t');
				var tokens = [];
				tokens[0] = line.substring(0, indexSpace);
				tokens[1] = line.substring(indexSpace + 1);
				var codelineTokens = tokens[0].split(':');
				errChkMsgs.push({
					message: tokens[1],
					file: gosrcpath + codelineTokens[0],
					line: codelineTokens[1],
					character: codelineTokens[2]
				});
				i++;
			}


			i = 0;
			max = errChkMsgs.length;
			while (i < max) {
				var errChkMsg = errChkMsgs[i];
				errcheckmessages.add(new LineMessageView({
					message: errChkMsg.message,
					file: errChkMsg.file,
					line: errChkMsg.line,
					character: errChkMsg.character,
					className: 'text-info'
				}));
				i++;
			}
		} else {
			errcheckmessages.add(new PlainMessageView({
				message: "errcheck pass",
				className: 'text-default'
			}));
		}

	});
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
	/*if (mode == 'referrers' || mode == 'definition') {
		messages.attach();
		messages.clear();
		messages.add(new PlainMessageView({
			message: 'loading...',
			className: 'text-default'
		}));
	}*/
	if (mode == 'referrers') {
		refmessages.attach();
		refmessages.clear();
		refmessages.add(new PlainMessageView({
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
	//html += formatInfo('desc', d.desc);
	if (typeof(v) !== 'undefined' && v != null) {
		//html += '<br />';
		html += formatInfo('type', v.type);
		if (typeof(v.objpos) !== 'undefined') {
			html += '<br />';
			html += formatInfo('objpos', v.objpos);
		}
		html += '<br />';
	}else{
		html += '-- no data --';
	}
	//html += formatInfo('detail', d.detail);

	atom.notifications.addInfo(html);
};

var getRefLineContent = function(tokens,callback) {
	var me = this;

	var file = tokens[0];
	var line = tokens[1];
	var char = tokens[2]

	getLine(file,line-1,function(err, lineDesc){
		if( lineDesc == null ){
			lineDesc = '';
		}
		callback(file,line,char,lineDesc);
	});

	return;
}

var referrers = function(json) {

	refmessages.clear();

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
		getRefLineContent(tokens,function(file,line,char,msg){
			refmessages.add(new LineMessageView({
				message: msg,
				file: file,
				line: line,
				character: char,
				className: 'text-info'
			}));
		});

		i++;
	}


};

var formatInfo = function(title, desc) {
	return '<b>' + title + '</b><br />' + desc + '';
}


function getLine(filename, line_no, callback) {
    var stream = fs.createReadStream(filename, {
      flags: 'r',
      encoding: 'utf-8',
      fd: null,
      mode: 0666,
      bufferSize: 64 * 1024
    });

    var fileData = '';
    stream.on('data', function(data){
      fileData += data;

      // The next lines should be improved
      var lines = fileData.split("\n");

      if(lines.length >= +line_no){
        stream.destroy();
        callback(null, lines[+line_no]);
      }
    });

    stream.on('error', function(){
      callback('Error', null);
    });

    stream.on('end', function(){
      callback('File end reached without finding line', null);
    });

}
