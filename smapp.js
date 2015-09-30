
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
  BREAK: "break",
  DECISION: "decision"
}

var Mode = {
  HALTED: "halted",
  OPEN: "open"
}

/***************************************************************
    ROUTES
*/


Router.route("/", function() {
  this.render("index")
});

Router.route("/create", function() {
  if (!Meteor.userId()) {
    this.redirect("/");
    return;
  }


  var code = parseInt(Math.random()*100) + "-" + parseInt(Math.random()*100) + "-" + parseInt(Math.random()*100);

  Events.insert({
    name: "Event " + code,
    code: code,
    owner: Meteor.userId(),
    mode: Mode.OPEN
  });

  this.redirect("/event/"+code)

})

Router.route("/event/:code", function() {
  if (!Meteor.userId()) {
    this.redirect("/");
    return;
  }
  var evt = Events.findOne({code:this.params.code});

  var pleads = Pleads.find({event_id:evt._id});
  var event_owner = Meteor.users.findOne(evt.owner);
  this.render("plist", {data:{pleads: pleads, evt:evt, event_owner:event_owner}});
});

Router.route("/login/:token", function() {
  Meteor.loginWithKth(this.params.token, function() {
    Router.go("/")
  })
})

/***************************************************************
    CLIENT CODE
*/
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
      if (this.evt.mode != Mode.OPEN) return;

      Pleads.insert({
        type: Type.PLEAD,
        creator: Meteor.user(),
        text: event.target.text.value,
        event_id: this.evt._id,
        image: event.target.imgurl.value,
        createdAt: new Date()
      });

      event.target.text.value = "";
      event.target.imgurl.value = "";
    },
    "click .logout": function() {
      Meteor.logout()
    },
  });

  Template.plist.helpers({
    ownEvent: function() {
      return Meteor.userId() == this.evt.owner;
    },
    ownPlead: function() {
      return Meteor.user() == this.plead.creator;
    }
  });

  Template.form.helpers({
    isOpen: function () {
      return this.evt.mode == Mode.OPEN;
    }
  });

  function setEventValueHelper(field) {
    return function(event) {
      var obj = {};
      obj[field] = event.target.value;

      Events.update(this.evt._id, {
        $set: obj
      });
    }
  }

  Template.admin.events({
    "change .txtName": setEventValueHelper("name"),
    "change select": setEventValueHelper("mode"),
    "change .txtDecide": function(event) {
      Pleads.insert({
        type: Type.DECISION,
        creator: Meteor.user(),
        text: event.target.value,
        event_id: this.evt._id
      });

      event.target.value = "";
    },
    "change .txtPoint": function(event) {
      console.log("asha");
      Pleads.insert({
        type: Type.POINT,
        creator: Meteor.user(),
        text: event.target.value,
        event_id: this.evt._id
      });

      event.target.value = "";
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

/***************************************************************
    SERVER CODE
*/

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
