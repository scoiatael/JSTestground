function check_obj (obj, strings) {
  if (typeof obj === 'undefined' || typeof strings === 'undefined') {
    console.log("obj or string undefined");
    return false;
  }
  for (var x in strings) {
    if(typeof obj[strings[x]] === 'undefined') {
      console.log("lack of " + strings[x]);
      console.log(obj);
      return false;
    }
  }
  return true;
}

var async_do = function(obj) {
  if (check_obj(obj, ["to_do_function", "starting_param"]) !== true) {
    console.log("Bad async_do params");
    return;
  }

  var fun = obj["to_do_function"];
  var startp = obj["starting_param"];
  var timeout = obj["timeout"] || 1000;
  var cont = true;
  var blackout;

  function loop (olddata) {
    var dat = fun(olddata);
    if (cont) {
      blackout = setTimeout(function() { loop(dat); }, timeout);
    }
  };

  function start () {
    cont = true;
    loop(startp);
  }

  function end () {
    cont = false;
  }

  return { start : start, end : end };
};

var gist_reader = function(obj) {

  if(check_obj(obj, ['update', 'id', 'githubAuth']) !== true){
    console.log('bad gist_reader obj');
    return;
  }; 

  var update_data = obj["update"];

  var gistNumber = 9132222;
  var id = obj["id"];

  var github = new Github(obj["githubAuth"]);
  var gist   = github.getGist(gistNumber)   ;
  
  function gist_pull () {
    gist.read(update_data);
  }

  function gist_send (arg) {
    var delta = { "files": {} };
    delta["files"][id] = {
      "content" : arg
    };
    gist.update(delta, update_data);
  }
  return { send:gist_send, pull:gist_pull };
};


var peer_finder = function(obj) {

  if(check_obj(obj, ["id", "peer_change"]) !== true) {
    console.log("bad find_peers obj");
    console.log(obj);
    return;
  }

  var running;
  var id = obj['id'];
  var peer_change = obj['peer_change'];

  var state_track = function() {
    var data;

    function process_data(dat) {
      if(typeof dat === 'undefined') {
        console.log("undefined data to process");
        return {};
      }
      var file_insides = {};
      for (var x in dat["files"]) {
        if(typeof dat["files"][x]["content"] === 'undefined') {
          console.log("undefined: " + x);
        } else {
          if( x !== 'Comments') {
            file_insides[x] = dat["files"][x]["content"];
          }
        }
      }
      data = file_insides;
    }

    function update_data(err, dat) {
      if(typeof err === 'undefined' || err === null) { 
        process_data(dat);
      } else {
        console.log("Update err: " + err.error.toString());
      }
    }

    function push_data(dat) {
      $( '#peers' ).html( "Inside gist:<br>" );
      for (var x in data) {
        $( '#peers' ).append( x + ' : ' + data[x] + '<br>');
      }
      for (var x in dat) {
        peer_change(x, dat[x]);
      }
    }

    function push_if_new(olddata) {
      var dat = data;
      var delta = {};
      if(typeof olddata === 'undefined') {
        push_data(dat);
        return dat;
      }
      for (var x in dat) {
        if(typeof olddata[x] === 'undefined' || olddata[x] !== dat[x] ) {
          delta[x] = dat[x];
        }
      }
      push_data(delta);
      return dat;
    };

    return { push : push_if_new, update : update_data, process : process_data, get : function() { return data; } };
  }();

  var push = state_track.push;
  var supdate = state_track.update;

  var gist_conn;

  var gist_send;
  var gist_pull;

  var async_show;

  var async_update; 

  function gist_register () {
    gist_send("OK");
  }
  
  function gist_unregister () {
    gist_send(null);
  }

  function init () {
    if(typeof running !== 'undefined') {
      return;
    }

    gist_conn = gist_reader({
        'update' : supdate,
        'id'     : id,
        'githubAuth' : myGithubAuth
      });

    gist_send = gist_conn.send;
    gist_pull = gist_conn.pull;

    async_show = async_do({ 
      'to_do_function' : push,
      'starting_param' : {} });

    async_update = async_do({
      'to_do_function' : gist_pull, 
      'timeout'        : 5000,
      'starting_param' : null }); 
  }

  function start () {
    init();
    gist_pull();
    //gist_register();
    async_show.start();
    async_update.start();
    running = true;
  }

  function stop () {
    init();
    if(running !== true) {
      return;
    };
    async_show.end();
    async_update.end();
    //gist_unregister();
    running = false;
  }

  return { start : start, stop : stop }
};

var main = function () {
  var id = (Math.floor(Math.random()*1313)).toString();
  var state = 'peer finding';
  var peer;
  var connections = {};

  function peer_receive (upd) {
    console.log('got ' + upd);
    $( '#output' ).append(upd + '<br>\n');
  }

  function close_connection (peerid) {
    connections[peerid].close();
    delete connections[peerid];
  }

  function new_peer (obj) {
    if(check_obj(obj, ["peerid", "conn"]) !== true) {
      console.log("bad new_peer arg");
      return;
    }
    connections[obj.peerid] = obj.conn;
    obj.conn.send(id + ' entered');
    obj.conn.on('data', peer_receive);
    //obj.conn.on('receive', peer_receive);
    obj.conn.on('close', function() { close_connection(obj.peerid); } ); 
  }

  function connect_with_peer(peerid) {
    if(typeof peer == 'undefined') {
      return;
    }
    var conn = peer.connect(peerid, {
      label:'chat',
      serialization:'none',
      metadata:{message:'chat'} });
    conn.on('open', function(){
      console.log('opened connection to ' + peerid.toString());
      new_peer({peerid : peerid, conn: conn}); 
    });
  };

  function peer_change (peerid, status) {
    console.log(peerid + " to " + status);
    if(typeof status === 'undefined' || status === null) {
      close_connection(peerid);
    }
    if(peerid !== id && status === 'OK' && (typeof connections[peerid] === 'undefined' || connections[peerid] === null)) {
      connect_with_peer(peerid);
    }
  };

  var peer_finding;

  function start_receiving () {
    peer.on('connection', function(conn) { 
      console.log('connection from ' + conn.peer.toString());
      new_peer({ peerid : conn.peer, conn : conn }); });
  }

  function start () {
    state = 'peer finding';
    if(typeof peer === 'undefined') {
      peer = new Peer({key : myApiKey });
    }
    peer.on('open', function(i) {
      console.log('opened with id ' + i.toString());
      start_receiving();
      id = i;
      if(typeof peer_finding === 'undefined') {
        peer_finding = peer_finder({
            'id' : id,
            'peer_change' : peer_change
          });
      };

      peer_finding.start(); 
    });
  }

  function stop () {
    state = 'paused : ' + state;
    each_connection(function (x) {
      close_connection(x);
    });
    if(typeof peer_finding !== 'undefined') {
      peer_finding.stop();
      //peer.destroy();
      //delete(peer);
    }
  }

  function each_connection (fn, st) {
    var ret = st;
    for (var x in connections) {
      fn(x, ret);
    }
    return ret;
  }

  function send(str) {
    peer_receive('me (' + id + ') : ' + str);
    each_connection(function (x) {
      console.log('sending to ' + x);
      connections[x].send(id + " : " + str);
    });
  }

  return { stop : stop, start : start, send : send }
}();

$( function() {
    var connect = function () {
      $( '#outputc' ).show();
      $( '#stop' ).html("<button>Disconnect</button>");
      $( '#stop' ).click(disconnect);
      main.start();
    }
    var disconnect = function () {
      $( '#outputc' ).hide();
      $( '#stop' ).html("<button>Connect</button>");
      $( '#stop' ).click(connect);
      main.stop();
    };
    $( '#send' ).click(function() { main.send( $( '#input' ).val() ); });
    disconnect();
   });

