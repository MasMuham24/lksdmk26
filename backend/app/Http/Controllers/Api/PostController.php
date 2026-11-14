<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PostController extends Controller
{
    public function index(Request $request)
    {
        $query = Post::with('user:id,name');
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")->orWhere('content', 'like', "%{$search}%");
            });
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->boolean('mine')) {
            if (!Auth::check()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Silakan login terlebih dahulu.',
                ], 401);
            }
            $query->where('user_id', Auth::id())->orderBy('position')->orderBy('id');
        } else {
            $query->latest();
        }
        $posts = $query->get();
        return response()->json([
            'success' => true,
            'data' => $posts,
            'meta' => [
                'total_results' => $posts->count(),
                'my_posts_count' => Auth::check()
                    ? Post::where('user_id', Auth::id())->count()
                    : 0,
            ],
        ]);
    }

    public function show($id)
    {
        $post = Post::with('user:id,name')->find($id);
        if (!$post) {
            return response()->json([
                'success' => false,
                'message' => 'Tempelan tidak ditemukan.',
            ], 404);
        }
        return response()->json([
            'success' => true,
            'data' => $post,
        ]);
    }

    public function store(Request $request)
    {
        if (!Auth::check()) {
            return response()->json([
                'success' => false,
                'message' => 'Silakan login terlebih dahulu.',
            ], 401);
        }
        $data = $this->validatePost($request);
        if ($data instanceof \Illuminate\Http\JsonResponse) {
            return $data;
        }
        $data['user_id'] = Auth::id();
        $data['position'] = (
            Post::where('user_id', Auth::id())->max('position') ?? -1
        ) + 1;

        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $filename = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
            $file->move(public_path('uploads/posts'), $filename);
            $data['image'] = 'uploads/posts/' . $filename;
        }

        $post = Post::create($data);
        return response()->json([
            'success' => true,
            'message' => 'Tempelan berhasil ditambahkan.',
            'data' => $post->load('user:id,name'),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $post = Post::find($id);
        if (!$post) {
            return response()->json([
                'success' => false,
                'message' => 'Tempelan tidak ditemukan.',
            ], 404);
        }
        if (!Auth::check()) {
            return response()->json([
                'success' => false,
                'message' => 'Silakan login terlebih dahulu.',
            ], 401);
        }
        if ($post->user_id !== Auth::id()) {
            return response()->json([
                'success' => false,
                'message' => 'Anda bukan pemilik tempelan ini.',
            ], 403);
        }
        $data = $this->validatePost($request);
        if ($data instanceof \Illuminate\Http\JsonResponse) {
            return $data;
        }
        unset($data['user_id'], $data['position']);

        if ($request->hasFile('image')) {
            $file = $request->file('image');
            $filename = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
            $file->move(public_path('uploads/posts'), $filename);

            if ($post->image && file_exists(public_path($post->image))) {
                @unlink(public_path($post->image));
            }
            $data['image'] = 'uploads/posts/' . $filename;
        } elseif (!$request->has('image') || $request->input('image') === null) {
            unset($data['image']);
        }

        $post->update($data);
        return response()->json([
            'success' => true,
            'message' => 'Tempelan berhasil diperbarui.',
            'data' => $post->load('user:id,name'),
        ]);
    }

    public function destroy($id)
    {
        $post = Post::find($id);
        if (!$post) {
            return response()->json([
                'success' => false,
                'message' => 'Tempelan tidak ditemukan.',
            ], 404);
        }
        if (!Auth::check()) {
            return response()->json([
                'success' => false,
                'message' => 'Silakan login terlebih dahulu.',
            ], 401);
        }
        if ($post->user_id !== Auth::id()) {
            return response()->json([
                'success' => false,
                'message' => 'Anda bukan pemilik tempelan ini.',
            ], 403);
        }
        if ($post->image && file_exists(public_path($post->image))) {
            @unlink(public_path($post->image));
        }
        $post->delete();
        return response()->json([
            'success' => true,
            'message' => 'Tempelan berhasil dihapus.',
        ]);
    }

    public function reorder(Request $request)
    {
        if (!Auth::check()) {
            return response()->json([
                'success' => false,
                'message' => 'Silakan login terlebih dahulu.',
            ], 401);
        }
        $validator = Validator::make($request->all(), [
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|integer|distinct',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Data urutan tidak valid.',
                'errors' => $validator->errors(),
            ], 422);
        }
        $ids = $validator->validated()['ids'];
        $result = DB::transaction(function () use ($ids) {
            $ownedIds = Post::where('user_id', Auth::id())->lockForUpdate()->pluck('id')->sort()->values()->all();
            $submittedIds = collect($ids)->map(fn ($id) => (int) $id)->sort()->values()->all();
            if ($ownedIds !== $submittedIds) {
                return false;
            }
            foreach ($ids as $position => $id) {
                Post::where('id', $id)->where('user_id', Auth::id())->update(['position' => $position]);
            }
            return true;
        });

        if (!$result) {
            return response()->json([
                'success' => false,
                'message' => 'Daftar ID tidak sesuai dengan seluruh tempelan milik Anda.',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Urutan tempelan berhasil diperbarui.',
        ]);
    }

    // Validasi berdasarkan jenis tempelan
    private function validatePost(Request $request)
    {
        $type = $request->input('type');

        // Kosongkan field yang tidak relevan.
        if ($type === 'photo') {
            $request->merge([
                'content' => null,
                'event_date' => null,
                'color' => null,
            ]);
        } elseif ($type === 'announcement') {
            $request->files->remove('image');
            $request->merge([
                'image' => null,
                'image_caption' => null,
                'color' => null,
            ]);
        } elseif ($type === 'note') {
            $request->files->remove('image');
            $request->merge([
                'image' => null,
                'image_caption' => null,
                'event_date' => null,
            ]);
        }

        $rules = [
            'type' => 'required|in:photo,announcement,note',
            'title' => 'required|string|max:80',
            'content' => 'nullable|string|max:500',
            'image' => 'nullable',
            'image_caption' => 'nullable|string|max:255',
            'event_date' => 'nullable|date',
            'color' => 'nullable|in:yellow,pink,blue',
        ];

        if ($type === 'photo') {
            if ($request->hasFile('image')) {
                $rules['image'] = 'required|file|image|mimes:jpeg,png,jpg,gif,webp|max:5120';
            } elseif ($request->isMethod('patch') || $request->isMethod('put') || $request->input('_method') === 'PATCH') {
                $rules['image'] = 'nullable';
            } else {
                $rules['image'] = 'required';
            }
        }

        if (in_array($type, ['announcement', 'note'])) {
            $rules['content'] = 'required|string|max:500';
        }

        if ($type === 'note') {
            $rules['color'] = 'required|in:yellow,pink,blue';
        }

        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validasi gagal.',
                'errors' => $validator->errors(),
            ], 422);
        }

        return $validator->validated();
    }
}
