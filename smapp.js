
/**

type Pleads ->
  _id ID
  event Event
  type Type
  creator User
  title String
  text String
  image String

type Events ->
  _id ID
  code String
  owner User
  name String
  mode Mode
*/

Pleads = new Mongo.Collection("pleads");
Events = new Mongo.Collection("events");

var Type = {
  PLEAD: "plead",
  POINT: "point",
  BREAK: "break"
}

var Mode = {
  HALTED: "halted",
  OPEN: "open"
}


Router.route("/", function() {
  this.render("index")
});

Router.route("/event/:code", function() {
  this.subscribe('events', {code:this.params.code}).wait()

  if (!Meteor.userId()) {
    this.redirect("/");
    return;
  }
  var evt = Events.findOne({code:this.params.code});
  if (!evt) {
    return;
  }
  var pleads = Pleads.find({event:evt});
  var event_owner = Meteor.users.findOne(evt.owner);
  this.render("plist", {data:{pleads: pleads, evt:evt, event_owner:event_owner}});
});

Router.route("/login/:token", function() {
  Meteor.loginWithKth(this.params.token, function() {
    Router.go("/")
  })
})

if (Meteor.isClient) {
  // counter starts at 0
  Session.setDefault('counter', 0);

  Template.registerHelper("loginurl", function() {
      var callback = ""
      callback += location.protocol + "//"
      callback += location.hostname
      if(location.port) {
        callback += ":" + location.port
      }
      callback += "/login/"
      return "http://login.datasektionen.se/login?callback=" + callback
    });

    Template.registerHelper('equals', function (a, b) {
      return a === b;
    });

  Template.plist.events({
    "submit #plead-form": function(event) {
      event.preventDefault();

      Pleads.insert({
        type: Type.PLEAD,
        creator: Meteor.user(),
        text: event.target.text.value,
        event: this.evt,
        image: event.target.imgurl.value
      });

      event.target.text.value = "";
      event.target.imgurl.value = "";
    },
    "click .logout": function() {
      Meteor.logout()
    },
  });

  Template.plist.helpers({
    isOpen: function() {
      return this.evt.mode == Mode.OPEN;
    },
    ownEvent: function() {
      return Meteor.userId() == this.evt.owner;
    },
    ownPlead: function() {
      return Meteor.user() == this.plead.creator;
    }
  });

  Template.admin.events({
    "change .txtName": function(event) {
      var code = $("input[name=event_code]").val();
      var evt = getOrCreateEvent(code);
      Events.update(evt._id, {
        $set: {name:event.target.value}
      });
    },
    "change select": function(event) {
        var code = $("input[name=event_code]").val();
        Events.update(this.evt._id, {
          $set: {mode:event.target.value}
        });
    }
  })

  Meteor.loginWithKth = function(token, callback) {
    if (!Meteor.user()) {
      Accounts.callLoginMethod({
        methodArguments: [{
          token: token
        }],
        userCallback: callback
      })
    } else if(callback) {
        callback()
    }
  };
}

if (Meteor.isServer) {
  var Future = Npm.require('fibers/future');

  Meteor.startup(function () {
    // code to run on server at startup
  });

  Accounts.registerLoginHandler("kth", function(loginRequest) {
    var future = new Future
    var url = "http://login.datasektionen.se/verify/" + loginRequest.token + ".json"
    Meteor.http.call("GET", url, function(err, data) {
      if(err) {
        console.error(err)
        future.return(undefined)
        return
      }
      var usomething = data.data.user
      var user = Meteor.users.findOne({
        usomething: usomething
      })
      var userId
      if(user) {
        future.return({
          userId: user._id,
          token: loginRequest.token
        })
      } else {
        url = "http://www.csc.kth.se/hacks/new/xfinger/results.php?freetext=" + usomething
        Meteor.http.call("GET", url, function(err, data) {
          if(err) {
            console.error(err)
            future.return(undefined)
            return
          }
          var username = data.content.match(/mailMe\('(\w+)/)[1]
          var userId = Meteor.users.insert({
            username: username,
            usomething: usomething
          })
          console.log("created", userId)
          future.return({
            userId: userId,
            token: loginRequest.token
          })
        })
      }
    })
    return future.wait()
  })
}
