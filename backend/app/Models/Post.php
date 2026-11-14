<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Post extends Model
{
    protected $fillable = [
        'user_id',
        'type',
        'title',
        'content',
        'image',
        'image_caption',
        'event_date',
        'color',
        'position',
    ];

    protected $appends = [
        'image_url',
    ];

    protected function cast(): array
    {
        return [
            'event_date' => 'date',
        ];
    }

    public function getImageUrlAttribute(): ?string
    {
        if (!$this->image) {
            return null;
        }
        if (str_starts_with($this->image, 'http://') || str_starts_with($this->image, 'https://')) {
            return $this->image;
        }
        return url($this->image);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
