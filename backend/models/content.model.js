const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    keywords: [{
        type: String,
        trim: true
    }],
    language: {
        type: String,
        required: true,
        default: 'fr'
    },
    contentType: {
        type: String,
        enum: ['blog', 'product', 'landing', 'social'],
        required: true
    },
    wordCount: {
        type: Number,
        required: true
    },
    seoScore: {
        type: Number,
        min: 0,
        max: 100
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'scheduled'],
        default: 'draft'
    },
    publishDate: Date,
    wpSiteId: {
        type: String,
        ref: 'WPSite'
    },
    wpPostId: String,
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    translations: [{
        language: String,
        content: String,
        title: String,
        wpPostId: String
    }],
    aiModel: {
        type: String,
        required: true,
        default: 'gpt-3.5-turbo'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt timestamp before saving
contentSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Content', contentSchema);
