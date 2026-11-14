<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class SessionController extends Controller
{
    public function show(Request $request)
    {
        return response()->json([
            'success' => true,
            'message' => [
                'user' => $request->user(),
                'csrf_token' => csrf_token(),
            ]
        ]);
    }

    public function index(Request $request)
    {
        return $this->show($request);
    }
}
