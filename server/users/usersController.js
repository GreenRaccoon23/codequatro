var Q = require('q');
var jwt = require('jwt-simple');
var pg = require('pg');
var connectString = process.env.DATABASE_URL || 'postgres://localhost:5432/closet';

exports = module.exports = {

  signin: function(req, res, next) {
	var attemptedUsername = req.body.username;
	var attemptedPassword = req.body.password;
	pg.connect(connectString, function (err, client, done){
	if(err) {
	  console.error(err);
	}
	client.query('SELECT username, password FROM users WHERE username = $1', [attemptedUsername], function (err, result){
	  if(result.rows.length === 0){
	    res.status(401).json({ answer: 'Invalid Username' });
	  } else {
	    var username = result.rows[0].username;
	    var password = result.rows[0].password;
	    if(attemptedPassword === password) {
	      var token = jwt.encode(result.rows[0].password, 'secret');
	      res.status(200).json({ token: token, username: username });
	    } else {
	      res.status(401).json({ answer: 'Invalid Password' });
	    }
	  }
	})
	})
  },

  signup: function(req, res, next) {
	var username = req.body.username;
	var password = req.body.password;
	var firstname = req.body.firstname;
	var lastname = req.body.lastname;
	var gender = req.body.gender;
	pg.connect(connectString, function (err, client, done){
	if(err) {
	  console.error(err);
	}
	client.query('INSERT INTO users (username, password, firstname, lastname, gender) VALUES ($1, $2, $3, $4, $5)', [username, password, firstname, lastname, gender], function (err, result){
	  if(err) {
	    console.log('not cool man. database error on signup: ', err)
	  } else {
	    res.status(201).json({ username: username }) // removed token as was undefined for signup
	    done();
	  }
	})
	})
  },

  updateUserInfo: function(req, res, next) {
  	var userID = req.body.userID;
  	var username = req.body.username;
	var firstname = req.body.firstname;
	var lastname = req.body.lastname;
	client.query('UPDATE users SET username = $2, firstname = $3, lastname = $4, WHERE user_id = $1', [userID, username, firstname, lastname])
	client.query('SELECT username, firstname, lastname FROM users WHERE user_id = $1', [userID], function (err, result){
		if(err) {
	    	console.error('error on lookup of user_id: ', err)
	    } else {
			var userInfo = {
				username: username,
				firstname: firstname,
				lastname: lastname
			};
			res.status(200).json(userInfo);
			done();
	    }
	})
  },

  getUserInfo: function(req, res, next) {
	var username = req.body.username;
	//create an object to send back to client
	var userInfo = {};

	pg.connect(connectString, function (err, client, done) {
	if(err) {
	  console.error('error connecting to the DB:', err);
	}
	else {
	  client.query('SELECT * FROM users WHERE username = $1', [username], function(err, result){
	    if(err) {
	      console.error('error on lookup of user_id: ', err)
	    }
	    else {
			var userId = result.rows[0].user_id;
			userInfo.userID = result.rows[0].user_id;
			userInfo.username = result.rows[0].username;
			userInfo.firstname = result.rows[0].firstname;
			userInfo.lastname = result.rows[0].lastname;
			userInfo.gender = result.rows[0].gender;
			//get all of the current users images
			client.query('SELECT image_name, image_id, type_id FROM images i, users u WHERE i.user_id = u.user_id and u.user_id = $1', [userId], function(err, result){
			if(err) {
			  console.error('error fetching closet images: ', err);
			}
			else{
			  userInfo.pics = result.rows;
			    //grab all of the votes for each user pic
			    client.query('SELECT images.image_name, images.image_id, votes.gender, votes.upvote, votes.downvote FROM images INNER JOIN votes ON images.image_id = votes.image_id and images.user_id=$1', [userId], function(err, result){
			        if(err) {
			        	console.error('error fetching votes: ', err);
			    	} else {
						userInfo.votes = result.rows;
						userInfo.userCredibility = 0;
						// Calculate votes for each pictures and user credibility			          
						for (var i = 0; i < result.rows.length; i++) {
							if (result.rows[i].upvote === 1) {
								userInfo.userCredibility++;
								for (var x = 0; x < userInfo.pics.length; x++) {
							  		if (!userInfo.pics[x].upvotes) userInfo.pics[x].upvotes = 0;
							  		if (result.rows[i].image_id === userInfo.pics[x].image_id) {
							  			userInfo.pics[x].upvotes++;
							  			if (!userInfo.pics[x].genderData) userInfo.pics[x].genderData = {male: {upvotes: 0, downvotes: 0}, female: {upvotes: 0, downvotes: 0}, other: {upvotes: 0, downvotes: 0}};
								  		if (result.rows[i].gender === 'male') userInfo.pics[x].genderData.male.upvotes++
								  		if (result.rows[i].gender === 'female') userInfo.pics[x].genderData.female.upvotes++
								  		if (result.rows[i].gender != 'male' && result.rows[i].gender != 'female') userInfo.pics[x].genderData.other.upvotes++
							  		}
							  	}
							} else if (result.rows[i].downvote === 1) {
								userInfo.userCredibility--;
								for (var y = 0; y < userInfo.pics.length; y++) {
									if (!userInfo.pics[y].downvotes) userInfo.pics[y].downvotes = 0;
				  					if (result.rows[i].image_id === userInfo.pics[y].image_id) {
							  			userInfo.pics[y].downvotes++;
							  			if (!userInfo.pics[y].genderData) userInfo.pics[y].genderData = {male: {upvotes: 0, downvotes: 0}, female: {upvotes: 0, downvotes: 0}, other: {upvotes: 0, downvotes: 0}};
								  		if (result.rows[i].gender === 'male') userInfo.pics[y].genderData.male.downvotes++
								  		if (result.rows[i].gender === 'female') userInfo.pics[y].genderData.female.downvotes++
								  		if (result.rows[i].gender != 'male' && result.rows[i].gender != 'female') userInfo.pics[y].genderData.other.downvotes++
							  		}
								}
							}
						}

						// Update User Credibility Score in Database for Efficiency When Grabbing Score Later
						client.query('UPDATE users SET credibilityScore = $2 WHERE username = $1', [username, userInfo.userCredibility])

						res.status(200).json(userInfo);
						done();
			        }
			    });
			  }
			});// end of user images query
	    }
	  });//end of userInfo query
	}
	}); //pg.connect
  },

  getAllUsers: function(req, res, next) {
	client.query('SELECT user_id, username, firstname, lastname, gender, credibilityScore FROM users', [], function (err, result){
		if(err) {
	    	console.error('error on lookup of top users: ', err)
	    } else {
			allUsers = result.rows;
			res.status(200).json(allUsers);
			done();
	    }
	})	
  }

}