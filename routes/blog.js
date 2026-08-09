const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { Blog } = require('../db/db');
const blogInput = require('../inputValidation/blogValidation');
const logger = require('../lib/logger');
const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
    const response = await Blog.find({});
    logger.info("All blogs fetched successfully");
    res.status(200).json({
        allBlogs: response
    })
})

router.get('/myblogs', authMiddleware, async (req, res) => {
    const response = await Blog.find({
        userId: req.userId
    })

    logger.info("My blogs fetched successfully");
    res.status(200).json({
        myBlogs: response
    })
})

router.put('/update', authMiddleware, async (req, res) => {
    const blogId = req.body.blogId;
    const title = req.body.title;
    const description = req.body.description;

    try {
        const parsedCredentials = blogInput.safeParse({
            title, description
        })
        if(!parsedCredentials.success){
            logger.error("wrong inputs provided for title or description");
            return res.status(401).json({
                msg: "wrong inputs for title or description"
            })
        }

        await Blog.findByIdAndUpdate({
            _id: blogId,
        },{
            title: title,
            description: description
        })

        logger.info("Blog updated successfully");
        res.status(200).json({
            msg: "blog updated successfully"
        })
    } catch (err) {
        logger.error("error updating blog");
        res.status(500).json({
            msg: "internal server error"
        })
    }
})

router.delete('/', authMiddleware, async (req, res) => {
    const blogId = req.body.blogId;

    await Blog.findOneAndDelete({
        _id: blogId
    })

    logger.info("Blog deleted successfully");
    res.status(200).json({
        msg: "blog deleted successfully"
    })
})


module.exports = router;