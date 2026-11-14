<?php

namespace Database\Seeders;

use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class MadingSeeder extends Seeder
{
    public function run(): void
    {
        $nadia = User::updateOrCreate(
            ['email' => 'nadia@sekolah.sch.id'],
            ['name' => 'Nadia Putri', 'password' => Hash::make('password123')]
        );

        $raka = User::updateOrCreate(
            ['email' => 'raka@sekolah.sch.id'],
            ['name' => 'Raka Pratama', 'password' => Hash::make('password123')]
        );

        $sinta = User::updateOrCreate(
            ['email' => 'sinta@sekolah.sch.id'],
            ['name' => 'Sinta Ayu', 'password' => Hash::make('password123')]
        );

        $bima = User::updateOrCreate(
            ['email' => 'bima@sekolah.sch.id'],
            ['name' => 'Bima Aditya', 'password' => Hash::make('password123')]
        );

        Post::truncate();

        Post::create([
            'user_id' => $nadia->id,
            'type' => 'photo',
            'title' => 'Jelajah alam',
            'image' => 'uploads/posts/jelajah_alam.jpg',
            'position' => 0,
        ]);

        Post::create([
            'user_id' => $raka->id,
            'type' => 'announcement',
            'title' => 'Pentas seni sekolah',
            'content' => "Jumat, 20 November 2026\nAula sekolah · 09.00 WIB\nMari hadir dan berkarya.",
            'event_date' => '2026-11-20',
            'position' => 0,
        ]);

        Post::create([
            'user_id' => $nadia->id,
            'type' => 'note',
            'title' => 'Sudut baca kelas',
            'content' => 'Bawa satu buku favoritmu. Kita saling bertukar cerita pada jam istirahat.',
            'color' => 'yellow',
            'position' => 1,
        ]);

        Post::create([
            'user_id' => $sinta->id,
            'type' => 'announcement',
            'title' => 'Pendaftaran klub',
            'content' => 'Klub fotografi membuka pendaftaran anggota baru. Hubungi pengurus OSIS.',
            'position' => 0,
        ]);

        Post::create([
            'user_id' => $bima->id,
            'type' => 'note',
            'title' => 'Ide pekan depan',
            'content' => 'Bagaimana kalau kita membuat pojok karya di perpustakaan?',
            'color' => 'yellow',
            'position' => 0,
        ]);

        Post::create([
            'user_id' => $nadia->id,
            'type' => 'photo',
            'title' => 'Cerita perjalanan',
            'image' => 'uploads/posts/cerita_perjalanan.jpg',
            'position' => 2,
        ]);
    }
}

