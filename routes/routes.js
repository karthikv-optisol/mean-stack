const express = require('express');
const User = require('../controllers/userController');
const Auth = require('../middleware/AuthMiddleware');
const Post = require('../controllers/postController');

const router = express.Router();

router.post('/login', User.login);

router.post('/register', User.register);

router.post('/my-account', User.myaccount);

router.get('/get-posts', Post.getPosts);

router.post('/create-post', Auth, Post.createPosts);

router.put('/edit-post', Auth, Post.editPosts);

router.delete('/delete-post', Auth, Post.deletePost);

module.exports = router;


